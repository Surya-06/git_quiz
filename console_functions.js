const config = require("./config.json");

var LOG = config.debug ? console.log.bind(console) : function () {};

function show_scores(studentMap) {
  console.log("Showing results");
  console.log("------------------------------------\n");
  var entries = studentMap.entries();
  for (var val of entries) {
    console.log("Student : " + val[0] + " || Score : " + val[1].score);
  }
  console.log("\n------------------------------------\n");
  return;
}

function help() {
  console.log("------------------------------------\n");
  console.log(
    `
          results ------ 'Display results'
          help ------ 'Display help'
          `
  );
  console.log("\n------------------------------------\n");
  return;
}

function activateConsoleFunctions(studentMap) {
  // Handle admin input to server
  var stdin = process.openStdin();

  stdin.addListener("data", function (command) {
    // convert to usable state
    command = command.toString().trim();
    if (command == "results") {
      show_scores(studentMap);
    } else if (command == "help") {
      help();
    }
    process.stdout.write(`COMMAND(Type 'help' for help) : `);
  });
}


module.exports = {
  activateConsoleFunctions
};