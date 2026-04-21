import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import './App.css';
import ParticleField from './components/ParticleField';
import LoginStep from './components/LoginStep';
import HospitalityStep from './components/HospitalityStep';
import CommandMap from './components/CommandMap';
import { buildBackendUrl } from './config/backend';

/**
 * Rakshak AI — Real-Time Crisis Command System
 *
 * 3-step deployment flow:
 *   Step 1: Login (Auth)
 *   Step 2: Hospitality Selection (Context)
 *   Step 3: Command Map (Deployment)
 *
 * Session persistence: state is saved to sessionStorage so that a page
 * refresh keeps the user on their current step instead of forcing a
 * full re-login. sessionStorage is cleared when the tab is closed.
 */

const SESSION_KEY = 'rakshak_session';

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSession(step, email, hospitality) {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ step, email, hospitality })
    );
  } catch {
    // storage unavailable — silently ignore
  }
}

export default function App() {
  // Restore from session on first render, otherwise start at step 1
  const saved = loadSession();
  const [currentStep, setCurrentStep] = useState(saved?.step ?? 1);
  const [userEmail, setUserEmail] = useState(saved?.email ?? '');
  const [hospitalityType, setHospitalityType] = useState(saved?.hospitality ?? null);
  const [backendReady, setBackendReady] = useState(false);

  // Wake up backend with aggressive retry polling (handles Render cold-start)
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    const MAX_ATTEMPTS = 20; // 20 × 4s = 80s max wait (plenty for Render)

    async function wakeBackend() {
      while (!cancelled && attempt < MAX_ATTEMPTS) {
        try {
          const res = await fetch(buildBackendUrl('/api/health'), {
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            console.log(`✅ Backend ready (attempt ${attempt + 1})`);
            if (!cancelled) setBackendReady(true);
            return;
          }
        } catch (_) {
          // Backend still waking up
        }
        attempt++;
        if (!cancelled && attempt < MAX_ATTEMPTS) {
          console.log(`⏳ Backend warming up... (attempt ${attempt}/${MAX_ATTEMPTS})`);
          await new Promise(r => setTimeout(r, 4000));
        }
      }
      // Even after max attempts, set ready so we don't permanently block
      if (!cancelled) {
        console.warn('⚠️ Backend warm-up timed out, proceeding anyway.');
        setBackendReady(true);
      }
    }

    wakeBackend();
    return () => { cancelled = true; };
  }, []);

  // Persist state to sessionStorage whenever it changes
  useEffect(() => {
    saveSession(currentStep, userEmail, hospitalityType);
  }, [currentStep, userEmail, hospitalityType]);

  // Push browser history when step changes so the back button works
  useEffect(() => {
    const stateObj = { step: currentStep };
    // Only push if the current history state differs (avoid duplicate pushes)
    if (!window.history.state || window.history.state.step !== currentStep) {
      window.history.pushState(stateObj, '', '');
    }
  }, [currentStep]);

  // Listen for browser back/forward button
  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state && typeof event.state.step === 'number') {
        setCurrentStep(event.state.step);
      } else {
        // If no state, go to step 1 (login) and push it so another back doesn't leave the app
        setCurrentStep(1);
        window.history.pushState({ step: 1 }, '', '');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  /** Step 1 → Step 2: After successful login */
  const handleLogin = ({ email }) => {
    setUserEmail(email);
    setCurrentStep(2);
  };

  /** Step 2 → Step 3: After hospitality selection & deploy */
  const handleHospitalitySelect = (type) => {
    setHospitalityType(type);
    setCurrentStep(3);
  };

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: 'var(--deep-space)' }}>
      {/* Background layers */}
      <div className="grid-bg" />
      {currentStep < 3 && <ParticleField />}

      {/* Step transitions */}
      <AnimatePresence mode="wait">
        {currentStep === 1 && (
          <LoginStep key="login" onLogin={handleLogin} />
        )}

        {currentStep === 2 && (
          <HospitalityStep key="hospitality" onSelect={handleHospitalitySelect} />
        )}

        {currentStep === 3 && (
          <CommandMap
            key="command-map"
            hospitalityType={hospitalityType}
            userEmail={userEmail}
            backendReady={backendReady}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
