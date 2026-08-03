import { RadioStudio } from "@/components/RadioStudio";
import { getChannels } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function RadioPage() {
  const channels = await getChannels();
  return (
    <main>
      <RadioStudio channels={channels} />
    </main>
  );
}
