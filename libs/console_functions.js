const config = require("../config.json"),
  code_handling = require('./code_handling.js');

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

function writeToExcel(data) {
  let final_data = '';
  final_data = final_data + 'Username\tTest Start Time\tTest End Time\tScore\tSubmitted\n';
  final_data = final_data + ' \t \t \t \t \n';
  for (var keys of data.keys()) {
    final_data = final_data + data.get(keys).username + '\t' + new Date(data.get(keys).testStartTime) + '\t' + new Date(data.get(keys).testEndTime) + '\t' + data.get(keys).score + '\t' + data.get(keys).submitted + '\n';
  }
  let filePath = code_handling.write_to_file(final_data, 'xls', 'Results');
  return filePath;
}

module.exports = {
  activateConsoleFunctions,
  writeToExcel
};