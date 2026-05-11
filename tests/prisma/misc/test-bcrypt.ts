import bcrypt from "bcrypt";

async function main() {
  const password = "test_password_123";
  const hash = await bcrypt.hash(password, 10);

  const ok = await bcrypt.compare(password, hash);
  const wrong = await bcrypt.compare("wrong_password", hash);

  console.log("bcrypt hash generated:", Boolean(hash));
  console.log("bcrypt correct password match:", ok);
  console.log("bcrypt wrong password match:", wrong);

  if (!ok || wrong) {
    throw new Error("bcrypt validation logic failed");
  }
}

main().catch((e) => {
  console.error("bcrypt test failed:", e);
  process.exit(1);
});
