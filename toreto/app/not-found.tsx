import Link from "next/link";

export default function NotFound() {
  return (
    <main className="static">
      <h1>This episode never aired.</h1>
      <p>The page you wanted was cut in the edit.</p>
      <p style={{ marginTop: "1.5rem" }}><Link className="btn" href="/">Back to episode one</Link></p>
    </main>
  );
}
