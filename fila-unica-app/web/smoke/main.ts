import "./stub";  // precisa vir antes de qualquer import que toque em localStorage
import { rodar } from "./percurso";

rodar()
  .then((falhas) => process.exit(falhas === 0 ? 0 : 1))
  .catch((e) => { console.error("estourou:", e); process.exit(1); });
