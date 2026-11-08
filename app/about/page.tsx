// Owner: UI (@SaagiiSG) builds the page; People + pitch writes the final text. AI use must be disclosed here.
export default function About() {
  return (
    <main className="prose max-w-2xl space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">How Skilltri works</h1>
      <p>We read real job posts from companies&apos; own public job feeds every morning, pull out the skills they ask for, and map them.</p>
      <h2 className="text-xl font-semibold">Where we use AI</h2>
      <ul className="list-disc pl-5">
        <li>Google Gemini reads each job post and lists the technical skills it asks for.</li>
        <li>Google Gemini suggests portfolio projects for a skill. These are labelled &quot;AI-suggested&quot;.</li>
      </ul>
      <h2 className="text-xl font-semibold">What we store about you</h2>
      <p>Your sign-in ID, your name and email from that sign-in, your target role and city, and the skills you save. Never your resume: we read it in memory and throw it away. Before you sign in we store nothing; your answers wait in a cookie on your own browser. We guess your city from your connection to pick a default view, and we never store that guess. &quot;Delete my data&quot; removes everything.</p>
      <p>If you join the waitlist, we use your email only to tell you once when Skilltri opens, and we never share it.</p>
    </main>
  );
}
