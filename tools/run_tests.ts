// Usage: deno run --allow-read --allow-run tools/run_tests.ts

async function getNames(currentPath: string) {
  const names: string[] = [];

  for await (const dirEntry of Deno.readDir(currentPath)) {
    const entryPath = `${currentPath}/${dirEntry.name}`;

    if (dirEntry.isDirectory) {
      const sub = await getNames(entryPath);
      sub.forEach((n) => names.push(n));
    } else {
      names.push(entryPath);
    }
  }

  return names;
}

function getComments(contents: string) {
  const comments: string[] = [];
  contents.split("\n").forEach((line) => {
    const pieces = line.split("//");
    if (pieces[1]) {
      comments.push("//" + pieces[1]);
    }
  });
  return comments;
}

function parseExpects(contents: string) {
  const comments = getComments(contents);
  return comments.filter((c) => c.startsWith("// expect:")).map((c) =>
    JSON.parse(c.replace("// expect:", "").trim())
  );
}

async function runTest(filename: string, contents: string): Promise<boolean> {
  const p = Deno.run({
    cmd: ["deno", "run", "--allow-all", "--unstable", "obi.ts", filename],
    stdout: "piped",
    stderr: "piped",
  });
  const output = new TextDecoder().decode(await p.output());
  const outputLines = output.split("\n");
  const expects = parseExpects(contents);
  let i = 0;
  let pass = true;
  const issues = [];
  while ((i < output.length || i < expects.length) && i < 500) {
    if (i < expects.length) {
      if (expects[i] !== outputLines[i]) {
        pass = false;
        issues.push(
          `Expected '${expects[i]}' but got '${outputLines[i]}' at #${i}.`,
        );
      }
      // Else OK.
    } else if (outputLines[i]) {
      pass = false;
      issues.push(`Got extra output '${outputLines[i]}' #${i}.`);
    }
    i += 1;
  }

  if (pass) {
    console.log(`\u001b[32mPASS\u001b[39m`, filename);
  } else {
    console.error(
      `\u001b[31mFAIL\u001b[39m`,
      filename,
      "\n" + issues.map((l) => "     " + l).join("\n"),
    );
  }
  await p.close();
  return pass;
}

{
  let testFiles = await getNames("tests");
  testFiles = testFiles.filter((n) => n.endsWith(".obi"));
  let allGood = true;
  let succeeded = 0;
  let failed = 0;

  for (const testFile of testFiles) {
    const source = await Deno.readTextFile(testFile);
    const good = await runTest(testFile, source);
    if (good) {
      succeeded += 1;
    } else {
      failed += 1;
      allGood = false;
    }
  }

  const total = succeeded + failed;
  if (allGood) {
    console.log(`Test Result: ${succeeded}/${total}.`);
  } else {
    console.error(`Test Result: ${succeeded}/${total}, ${failed} failed.`);
    Deno.exit(65);
  }
}
