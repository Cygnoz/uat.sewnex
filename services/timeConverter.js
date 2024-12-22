const moment = require("moment-timezone");


function formatCustomDateTime(dateTime, dateFormat, timeZone, dateSplit) {
  const dateTimeMoment = moment(dateTime).tz(timeZone);

  // Format the date with split character
  let formattedDate = dateTimeMoment.format(dateFormat);
  if (dateSplit) {
    formattedDate = formattedDate.replace(/\//g, dateSplit);
  }

  // Format the time
  const formattedTime = dateTimeMoment.format('hh:mm:ss A');

  return { formattedDate, formattedTime };
}

module.exports = { formatCustomDateTime };
