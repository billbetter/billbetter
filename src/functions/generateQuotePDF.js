import { sdk } from "@/api/sdk";

export async function generateQuotePDF({ quote, settings }) {
  return sdk.functions.invoke("generateQuotePDF", { quote, settings });
}
