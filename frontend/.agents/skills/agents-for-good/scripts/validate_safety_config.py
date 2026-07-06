import os
import sys

# Reconfigure stdout/stderr to use UTF-8 on Windows to prevent UnicodeEncodeError
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

def find_workspace_root():
    curr = os.path.abspath(os.path.dirname(__file__))
    while True:
        if os.path.isdir(os.path.join(curr, "backend", "backend-python")) and os.path.isdir(os.path.join(curr, "backend", "backend-node")):
            return curr
        parent = os.path.dirname(curr)
        if parent == curr:
            break
        curr = parent
    return os.getcwd()

def load_env_file(filepath):
    """Simple parser for .env files without external dependencies."""
    env = {}
    if not os.path.exists(filepath):
        return env
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, val = line.split('=', 1)
                env[key.strip()] = val.strip().strip('"').strip("'")
    return env

def main():
    print("==================================================")
    print("[Safe System] RAKSHAK AI: Safety and Configuration Validator")
    print("==================================================")
    
    # Check parents or children depending on running location
    base_dir = find_workspace_root()
    python_env_path = os.path.join(base_dir, "backend", "backend-python", ".env")
    node_env_path = os.path.join(base_dir, "backend", "backend-node", ".env")
    
    python_env = load_env_file(python_env_path)
    node_env = load_env_file(node_env_path)
    
    issues = 0
    warnings = []
    
    # 1. Check Python Configs
    print("\n--- Checking Python Backend Environment ---")
    gemini_key = python_env.get("GEMINI_API_KEY")
    if not gemini_key:
        print("[FAIL] GEMINI_API_KEY: Missing from Python backend .env")
        issues += 1
    elif any(placeholder in gemini_key.lower() for placeholder in ["your_key", "placeholder", "todo", "insert"]):
        print(f"[WARN] GEMINI_API_KEY: Found but contains placeholder '{gemini_key}'")
        warnings.append("GEMINI_API_KEY is a placeholder")
    else:
        print("[PASS] GEMINI_API_KEY: Configured")

    # 2. Check Node Configs
    print("\n--- Checking Node Backend Environment ---")
    twilio_sid = node_env.get("TWILIO_ACCOUNT_SID")
    twilio_token = node_env.get("TWILIO_AUTH_TOKEN")
    twilio_phone = node_env.get("TWILIO_PHONE_NUMBER")
    
    if not twilio_sid:
        print("[FAIL] TWILIO_ACCOUNT_SID: Missing from Node backend .env")
        issues += 1
    elif "your_twilio" in twilio_sid.lower() or "placeholder" in twilio_sid.lower():
        print(f"[WARN] TWILIO_ACCOUNT_SID: Found but contains placeholder '{twilio_sid}'")
        warnings.append("TWILIO_ACCOUNT_SID is a placeholder")
    else:
        print("[PASS] TWILIO_ACCOUNT_SID: Configured")
        
    if not twilio_token:
        print("[FAIL] TWILIO_AUTH_TOKEN: Missing from Node backend .env")
        issues += 1
    elif "your_auth" in twilio_token.lower() or "placeholder" in twilio_token.lower():
        print(f"[WARN] TWILIO_AUTH_TOKEN: Found but contains placeholder")
        warnings.append("TWILIO_AUTH_TOKEN is a placeholder")
    else:
        print("[PASS] TWILIO_AUTH_TOKEN: Configured")
        
    if not twilio_phone:
        print("[FAIL] TWILIO_PHONE_NUMBER: Missing from Node backend .env")
        issues += 1
    elif "your_phone" in twilio_phone.lower() or "placeholder" in twilio_phone.lower():
        print(f"[WARN] TWILIO_PHONE_NUMBER: Found but contains placeholder '{twilio_phone}'")
        warnings.append("TWILIO_PHONE_NUMBER is a placeholder")
    else:
        print("[PASS] TWILIO_PHONE_NUMBER: Configured")

    print("\n==================================================")
    if issues > 0:
        print(f"[FAIL] Validation FAILED with {issues} missing critical variables.")
        sys.exit(1)
    elif warnings:
        print(f"[WARN] Validation PASSED with warnings: {', '.join(warnings)}")
        sys.exit(0)
    else:
        print("[PASS] Configuration is fully VALID and ready for secure operations!")
        sys.exit(0)

if __name__ == "__main__":
    main()
