const config = require("../config.json"),
  code_handling = require('./code_handling.js'),
  xlsx = require('xlsx'),
  path = require('path');

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

function writeToExcel(data, questionCount) {
  LOG('Starting to write data');
  let final_data = [];
  let headers = ['Username', 'Test Start Time', 'Test End Time', 'Score', 'Submitted'];
  for (let i = 1; i <= questionCount; i++) {
    headers.push('Question ' + i);
    headers.push('Answer ' + i);
  }
  final_data.push(headers);
  for (var keys of data.keys()) {
    var user_data = [];
    user_data.push(data.get(keys).username);
    user_data.push(new Date(data.get(keys).testStartTime));
    user_data.push(new Date(data.get(keys).testEndTime));
    user_data.push(data.get(keys).score);
    user_data.push(data.get(keys).submitted);
    let answers = data.get(keys).answers;
    for (let i in answers) {
      let question_value = answers[i].question;
      if (answers[i].code) question_value = question_value + '\n' + answers[i].code;
      user_data.push(JSON.stringify(question_value));
      user_data.push(JSON.stringify(answers[i].answer));
    }
    final_data.push(user_data);
    LOG('Pushing user data : ', user_data);
  }
  let ws_name = "Results",
    wb = xlsx.utils.book_new(),
    ws = xlsx.utils.aoa_to_sheet(final_data);
  xlsx.utils.book_append_sheet(wb, ws, ws_name);
  let filePath = '/data/Results.xlsx';
  xlsx.writeFile(wb, path.resolve(__dirname + '/..' + filePath));
  LOG('Completed writing to file');
  return filePath;
}

module.exports = {
  activateConsoleFunctions,
  writeToExcel
};