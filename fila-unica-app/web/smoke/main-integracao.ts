import "./stub";
import { rodar } from "./integracao";

rodar()
  .then((f) => process.exit(f === 0 ? 0 : 1))
  .catch((e) => { console.error("estourou:", e); process.exit(1); });
