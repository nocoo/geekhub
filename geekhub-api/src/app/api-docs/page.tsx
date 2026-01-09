import { getApiDocs } from "@/lib/swagger";
import ReactSwagger from "./ReactSwagger";

export default async function ApiDocsPage() {
  const spec = await getApiDocs();
  return (
    <section>
      <ReactSwagger spec={spec} />
    </section>
  );
}
