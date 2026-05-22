import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import Nav from "@/components/Nav";
import UploadForm from "@/components/UploadForm";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <Nav user={user} />
      <div className="container">
        <h1>Upload OFAC alert PDF</h1>
        <p className="subtitle">
          Upload a PDF of flagged transactions. The app reads each alert and
          buckets it automatically — no fixed format required.
        </p>
        <UploadForm />
      </div>
    </>
  );
}
