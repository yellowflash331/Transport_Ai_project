import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Note: tanstackStart() already wires up @tanstack/router-plugin's route
// generator and code-splitter internally. Registering `tanstackRouter(...)`
// again here runs the code-splitting transform twice on the same route
// files, which breaks it (dropped `TSRSplitComponent` declaration, causing
// "ReferenceError: TSRSplitComponent is not defined" at dev/build time).
export default defineConfig({
  plugins: [tanstackStart({ server: { entry: "server" } }), react(), tailwindcss(), tsconfigPaths()],
});
