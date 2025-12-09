import { Button } from "./base/Button";

export function Welcome() {
  const styles = {
    container: {
      maxWidth: "800px",
      margin: "0 auto",
      fontFamily: "var(--pico-font-family-sans-serif, sans-serif)",
      lineHeight: "1.6",
      paddingBottom: "4rem",
    },
    header: {
      borderBottom: "1px solid #eee",
      paddingBottom: "1rem",
      marginBottom: "2rem",
    },
    section: {
      marginBottom: "3rem",
    },
    list: {
      paddingLeft: "1.5rem",
    },
    item: {
      marginBottom: "0.5rem",
    },
    code: {
      background: "#f4f4f4",
      padding: "2px 5px",
      borderRadius: "4px",
      fontSize: "0.9em",
    },
  };

  const Link = ({ href, children }) => (
    <a
      href={href}
      style={{
        color: "#005a8a",
        textDecoration: "none",
        fontWeight: "bold",
      }}
      target="_parent"
    >
      {children}
    </a>
  );

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={{ marginTop: 0 }}>Gemini Nano A11y Auditor UI</h1>
        <p>
          Welcome to the component library for the{" "}
          <a href="https://github.com/shkeating/nano-a11y-audit">
            Gemini Nano A11y Auditor
          </a>
          . This project is built using <strong>Preact</strong> and styled with{" "}
          <strong>CSS Modules</strong> and <strong>Pico.css</strong>.
        </p>
      </header>

      <section style={styles.section}>
        <h2>Base Components</h2>
        <p>
          Atomic building blocks used throughout the application. They are
          stateless and reusable.
        </p>
        <ul style={styles.list}>
          <li style={styles.item}>
            <Link href="/?path=/docs/base-button--docs">Button</Link>: Standard
            interactive buttons supporting{" "}
            <code style={styles.code}>primary</code>,{" "}
            <code style={styles.code}>secondary</code>, and{" "}
            <code style={styles.code}>contrast</code> variants.
          </li>
          <li style={styles.item}>
            <Link href="/?path=/docs/base-checkbox--docs">Checkbox</Link>: Form
            controls for toggling boolean settings.
          </li>
          <li style={styles.item}>
            <Link href="/?path=/docs/base-fileinput--docs">FileInput</Link>:
            Wrapper around native file input for CSV uploads.
          </li>
          <li style={styles.item}>
            <Link href="/?path=/docs/base-logconsole--docs">LogConsole</Link>:
            Auto-scrolling text area for real-time audit feedback.
          </li>
          <li style={styles.item}>
            <Link href="/?path=/docs/base-modal--default">Modal</Link>:
            Accessible dialog overlay for configuration.
          </li>
          <li style={styles.item}>
            <Link href="/?path=/docs/base-progressbar--docs">ProgressBar</Link>:
            Visual indicator for batch completion status.
          </li>
          <li style={styles.item}>
            <Link href="/?path=/docs/base-textarea--docs">TextArea</Link>:
            Multi-line inputs for configuring lists.
          </li>
        </ul>
      </section>

      <section style={styles.section}>
        <h2>View Components</h2>
        <p>
          Major application states that compose Base components into full
          layouts.
        </p>
        <ul style={styles.list}>
          <li style={styles.item}>
            <Link href="/?path=/docs/views-setupview--default">SetupView</Link>:
            The initial state (Upload & Settings).
          </li>
          <li style={styles.item}>
            <Link href="/?path=/docs/views-auditview--idle">AuditView</Link>:
            The active auditing state (Progress & Logs).
          </li>
          <li style={styles.item}>
            <Link href="/?path=/docs/views-completeview--default">
              CompleteView
            </Link>
            : The final reporting state.
          </li>
          <li style={styles.item}>
            <Link href="/?path=/docs/views-settingsmodal--open">
              SettingsModal
            </Link>
            : Complex configuration form.
          </li>
        </ul>
      </section>

      <section style={styles.section}>
        <h2>Usage Tips</h2>
        <ul>
          <li style={styles.item}>
            <strong>Accessibility:</strong> Use the "Accessibility" tab below to
            verify contrast and ARIA labels.
          </li>
        </ul>
      </section>
    </div>
  );
}
