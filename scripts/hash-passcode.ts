/**
 * Usage: npm run hash-passcode -- "my-passcode"
 * Paste the output into JUDGE_PASSCODE_HASH or ORGANIZER_PASSCODE_HASH.
 */
import { hashPasscode } from "../lib/passcode";

const pass = process.argv[2];
if (!pass || pass.length < 8) {
  console.error('Usage: npm run hash-passcode -- "<passcode, 8+ characters>"');
  process.exit(1);
}
console.log(hashPasscode(pass));
