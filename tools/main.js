import minimist from 'minimist';

export default function () {
  const argv = minimist(process.argv.slice(2));

  const commandName = argv._.shift();

  let command = require(`./${commandName}`);
  if (command.default) {
    command = command.default;
  }
  Promise.resolve(command(argv)).catch((e) =>
    setImmediate(() => {
      throw e;
    })
  );
}
