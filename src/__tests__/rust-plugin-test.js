import * as shelljs from 'shelljs';
import path from 'path';

const whichCargo = shelljs.which('cargo');
const rustInstalled = whichCargo && whichCargo.code === 0;

const rustCalcDir = path.join(__dirname, 'rust-calc');

if (rustInstalled) {
  describe('rust plugin', () => {
    beforeAll(() => {
      shelljs.exec('make', {
        cwd: path.join(rustCalcDir, 'calc-syntax'),
      });
    }, 10000);

    it('calc rust example should build, also output must match expected value', () => {
      const runResult = shelljs.exec('cargo run --quiet', {
        silent: true,
        cwd: rustCalcDir,
      });

      expect(runResult.stderr).toEqual('');
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
        'rust toolchain is not installed, tests for rust plugin will be skipped'
      );
    });
  });
}
