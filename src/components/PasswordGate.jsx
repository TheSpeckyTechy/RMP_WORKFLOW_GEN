// ─── PasswordGate.jsx ────────────────────────────────────────────────────────
// Full-page password prompt shown before the app loads.
// Uses the Web Crypto API (SHA-256) to verify the password without sending
// it anywhere. Auth state lives in sessionStorage — cleared when the tab closes.
//
// To change the password: run the following in a browser console and replace
// STORED_HASH below with the output:
//
//   const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('your-new-password'));
//   console.log(Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join(''));
//
// Default password: rmp-studio
// ─────────────────────────────────────────────────────────────────────────────

const PasswordGate = ({ onAuth }) => {
  const STORED_HASH = "fb3e750c31e3d928d00fa1b0fb99d060412fe53d85ce538eda90079be061b461";

  const [value, setValue]   = React.useState("");
  const [error, setError]   = React.useState(false);
  const [shake, setShake]   = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const verify = async () => {
    if (!value || loading) return;
    setLoading(true);
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    if (hex === STORED_HASH) {
      sessionStorage.setItem("rmp_authed", "1");
      onAuth();
    } else {
      setError(true);
      setShake(true);
      setValue("");
      setTimeout(() => setShake(false), 500);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter") verify();
    if (error) setError(false);
  };

  return (
    <div className="gate-backdrop">
      <div className={"gate-card" + (shake ? " gate-shake" : "")}>
        <div className="gate-logo">
          <div className="gate-logo-mark">RMP</div>
          <div className="gate-logo-text">Design Studio</div>
        </div>
        <div className="gate-body">
          <p className="gate-hint">Enter the access password to continue.</p>
          <div className={"gate-field" + (error ? " gate-field-err" : "")}>
            <input
              type="password"
              placeholder="Password"
              value={value}
              onChange={e => { setValue(e.target.value); setError(false); }}
              onKeyDown={handleKey}
              autoFocus
            />
          </div>
          {error && <p className="gate-error">Incorrect password — try again.</p>}
          <button
            className={"btn primary gate-btn" + (loading ? " gate-btn-loading" : "")}
            onClick={verify}
            disabled={!value || loading}
          >
            {loading ? "Checking…" : "Unlock"}
          </button>
        </div>
      </div>
    </div>
  );
};

window.PasswordGate = PasswordGate;
