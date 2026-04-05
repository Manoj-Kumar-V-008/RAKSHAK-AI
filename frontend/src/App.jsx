import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import './App.css';
import ParticleField from './components/ParticleField';
import LoginStep from './components/LoginStep';
import HospitalityStep from './components/HospitalityStep';
import CommandMap from './components/CommandMap';

/**
 * Rakshak AI — Real-Time Crisis Command System
 *
 * 3-step deployment flow:
 *   Step 1: Login (Auth)
 *   Step 2: Hospitality Selection (Context)
 *   Step 3: Command Map (Deployment)
 */
export default function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [userEmail, setUserEmail] = useState('');

  // Wake up backend automatically when frontend is loaded
  useEffect(() => {
    fetch("https://rakshak-backend-wbuz.onrender.com/api/health")
      .catch(err => console.error("Failed to wake backend:", err));
  }, []);
  const [hospitalityType, setHospitalityType] = useState(null);

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
          />
        )}
      </AnimatePresence>
    </div>
  );
}
