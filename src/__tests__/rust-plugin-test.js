import * as shelljs from 'shelljs';
import path from 'path';

// rust-calc test package uses Rust 2018, minimum version for that rust edition is 1.31
// https://blog.rust-lang.org/2018/12/06/Rust-1.31-and-rust-2018.html
const rustVersionRequired = [1, 31];

const whichCargo = shelljs.which('cargo');
const whichMake = shelljs.which('make');
const rustInstalled = whichCargo && whichCargo.code === 0;
const makeInstalled = whichMake && whichMake.code === 0;
const rustCalcDir = path.join(__dirname, 'rust-calc');

function getRustVersion() {
  const child = shelljs.exec('cargo --version');
  if (child.code === 0) {
    const semverRe = /\d+\.\d+\.\d+/;
    const match = semverRe.exec(child.stdout);
    if (match) {
      return match[0].split('.').map(x => Number(x));
    }
  }
  return [];
}

function semverGte(aNumbers, bNumbers) {
  if (!aNumbers || !bNumbers) {
    return false;
  }
  const maxLen = Math.max(aNumbers.length, bNumbers.length);
  let eq = false;
  for (let i = 0; i < maxLen; i++) {
    const aNum = aNumbers[i];
    const bNum = bNumbers[i];

    if (aNum > bNum) {
      return true;
    } else if (aNum < bNum) {
      return false;
    } else {
      eq = true;
    }
  }
  return eq;
}

const rustVersion = getRustVersion();
const minimumVersionSatisfied = semverGte(rustVersion, rustVersionRequired);

if (makeInstalled && rustInstalled && minimumVersionSatisfied) {
  describe('rust plugin', () => {
    beforeAll(() => {
      shelljs.exec('make', {
        cwd: path.join(rustCalcDir, 'calc-syntax'),
      });
    }, 10000);

    it('calc rust example should build, also output must match expected value', () => {
      let runResult = shelljs.exec('cargo run --quiet', {
        silent: true,
        cwd: rustCalcDir,
      });

      if (runResult.code !== 0) {
        // something went wrong, rerun command with full debug output
        runResult = shelljs.exec('cargo run', {
          silent: false,
          cwd: rustCalcDir,
        });
        console.error(runResult.stderr);
      } else {
        expect(runResult.stderr).toEqual('');
      }

      expect(runResult.code).toEqual(0);
      const stdout = runResult.stdout.toString('utf8');

      const match = /parse result: (\d+)/.exec(stdout);
      expect(match).not.toBeNull();
      expect(match[1]).toEqual('6');
    });
  });
} else {
  describe('rust plugin mock', () => {
    it('noop', () => {
      console.warn(
        `make and rust toolchain version ${rustVersionRequired.join(
          '.'
        )} or greater are not installed.`,
        `Tests for rust plugin will be skipped.`
      );
    });
  });
}
