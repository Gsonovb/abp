import execa from 'execa';
import fse from 'fs-extra';
import program from 'commander';
import replaceWithPreview from './replace-with-preview';

program
  .option(
    '-v, --nextVersion <version>',
    'next semantic version. Available versions: ["major", "minor", "patch", "premajor", "preminor", "prepatch", "prerelease", "or type a custom version"]',
  )
  .option('-p, --preview', 'publish with preview tag');

program.parse(process.argv);

const publish = async () => {
  const versions = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'];

  if (!program.nextVersion) {
    console.error('Please provide a version with --nextVersion attribute');
    process.exit(1);
  }

  const registry = program.preview
    ? 'https://www.myget.org/F/abp-nightly/npm'
    : 'https://registry.npmjs.org';

  try {
    await fse.remove('../dist');

    await execa('yarn', ['install'], { stdout: 'inherit', cwd: '../' });

    await fse.rename('../lerna.version.json', '../lerna.json');

    await execa(
      'yarn',
      [
        'lerna',
        'version',
        program.nextVersion,
        '--yes',
        '--no-commit-hooks',
        '--skip-git',
        '--force-publish',
      ],
      { stdout: 'inherit', cwd: '../' },
    );

    await fse.rename('../lerna.json', '../lerna.version.json');

    await execa('yarn', ['replace-with-tilde']);

    if (program.preview) await replaceWithPreview(program.nextVersion);

    await execa('yarn', ['build', '--noInstall'], { stdout: 'inherit' });

    await fse.rename('../lerna.publish.json', '../lerna.json');

    await execa(
      'yarn',
      [
        'lerna',
        'exec',
        '--',
        `"npm publish --registry ${registry}${program.preview ? ' --tag preview' : ''}"`,
      ],
      {
        stdout: 'inherit',
        cwd: '../',
      },
    );

    await fse.rename('../lerna.json', '../lerna.publish.json');

    if (!program.preview) {
      await execa('git', ['add', '../packages/*', '../package.json', '../lerna.version.json'], {
        stdout: 'inherit',
      });
      await execa('git', ['commit', '-m', 'Upgrade ng package versions', '--no-verify'], {
        stdout: 'inherit',
      });
    }
  } catch (error) {
    console.error(error.stderr);
    process.exit(1);
  }

  process.exit(0);
};

publish();

export default publish;
