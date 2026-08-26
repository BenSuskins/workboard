import { redirect } from "next/navigation";

/** The three report kinds are separate pages; /reports keeps working by landing on one. */
export default function ReportsIndex() {
  redirect("/reports/digest");
}
