# Security

Please do not publish security vulnerabilities in a public issue.

Report them privately through GitHub's security-advisory flow for this repository. Include the affected route or component, a minimal reproduction, and the impact you observed. Do not include real API keys, screenplay text, or other private project data.

Scriptlook stores provider keys in browser local storage and sends them through the locally running Next.js application only when a generation request is started. Anyone deploying a modified copy is responsible for securing that deployment and clearly describing its data handling.
