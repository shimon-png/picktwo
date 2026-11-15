import { getConfig } from "@/server/services/config";
import { ConfigEditor } from "@/components/admin/AdminActions";

export default async function AdminConfig() {
  const { economy, features } = await getConfig();
  return <ConfigEditor economy={economy} features={features} />;
}
