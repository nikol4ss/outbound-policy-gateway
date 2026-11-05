import { PublicHeader } from "../../components/ui";
import { LoginForm } from "../../components/login-form";

export default function LoginPage() {
  return <><PublicHeader/><main id="main" className="login-main"><div className="login-heading"><h1>Open your workspace.</h1><p>Access your calling policy, integrations, and audit trail.</p></div><LoginForm/></main></>;
}
