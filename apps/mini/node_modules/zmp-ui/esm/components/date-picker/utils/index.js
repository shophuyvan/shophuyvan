import { dayFormatter, monthFormatter, shortMonthFormatter, yearFormatter } from "../../../utils/date";
import { COLUMN_FORMATS, DATE_COL_NAME, DEFAULT_DATE_PICKER_COLUMN_FORMAT, MONTH_COL_NAME, YEAR_COL_NAME } from "../common/constants";

/**
 * Get the number of days in the month
 */
export var getMonthlyDay = function getMonthlyDay(year, month) {
  var day = 31;
  if (month === 1 || month === 3 || month === 5 || month === 7 || month === 8 || month === 10 || month === 12) {
    day = 31;
  } else if (month === 4 || month === 6 || month === 11 || month === 9) {
    day = 30;
  } else if (month === 2) {
    if (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) {
      day = 29;
    } else {
      day = 28;
    }
  }
  return day;
};

/**
 * Get the start and end date, month, year of the date range
 */
export var getDateRange = function getDateRange(startDate, endDate) {
  var result = {
    startDate: startDate.getDate(),
    startMonth: startDate.getMonth() + 1,
    startYear: startDate.getFullYear(),
    endDate: endDate.getDate(),
    endMonth: endDate.getMonth() + 1,
    endYear: endDate.getFullYear()
  };
  return result;
};

/**
 * Get the position of the current month and year in the date range
 */
export var getPosition = function getPosition(_ref) {
  var currentMonth = _ref.currentMonth,
    currentYear = _ref.currentYear,
    startDate = _ref.startDate,
    endDate = _ref.endDate;
  var _getDateRange = getDateRange(startDate, endDate),
    startMonth = _getDateRange.startMonth,
    startYear = _getDateRange.startYear,
    endMonth = _getDateRange.endMonth,
    endYear = _getDateRange.endYear;
  return {
    isStartMonth: startMonth && currentYear === startYear && currentMonth <= startMonth,
    isEndMonth: endMonth && currentYear === endYear && currentMonth >= endMonth,
    isStartYear: startYear && currentYear <= startYear,
    isEndYear: endYear && currentYear >= endYear
  };
};

/**
 * Convert a date to an object with the year, month, and day as keys
 * Example: {YYYY: 2020, MM: 12, DD: 31}
 */
export var convertDateToPickerValue = function convertDateToPickerValue(date) {
  var _ref2;
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  var day = date.getDate();
  return _ref2 = {}, _ref2[YEAR_COL_NAME] = year.toString(), _ref2[MONTH_COL_NAME] = month.toString(), _ref2[DATE_COL_NAME] = day.toString(), _ref2;
};

/**
 * Check if a number has two digits or not
 */
export var twoDigits = function twoDigits(number) {
  return number < 10 ? "0" + number : number;
};

/**
 * Format a date according to the specified format
 */
export var formatDate = function formatDate(d, config) {
  if (config === void 0) {
    config = {};
  }
  var date = new Date(d);
  var year = date.getFullYear();
  var month = date.getMonth();
  var month1 = month + 1;
  var day = date.getDate();
  var _config = config,
    dateFormat = _config.dateFormat,
    locale = _config.locale;
  if (typeof dateFormat === "string") {
    var tokens = {
      yyyy: year,
      yy: String(year).substring(2),
      mm: twoDigits(month1),
      m: month1,
      MM: monthFormatter(locale).format(date),
      M: shortMonthFormatter(locale).format(date),
      dd: twoDigits(day),
      d: day
    };

    // eslint-disable-next-line security/detect-non-literal-regexp
    var regexp = new RegExp(Object.keys(tokens).map(function (t) {
      return "(" + t + ")";
    }).join("|"), "g");
    return dateFormat.replace(regexp, function (token) {
      if (token in tokens) return "" + tokens[token];
      return token;
    });
  }
  if (typeof dateFormat === "function") {
    return dateFormat(date);
  }

  // Intl Object
  var formatter = new Intl.DateTimeFormat(locale, dateFormat);
  return formatter.format(date);
};

/**
 * Generate the date picker columns to be passed into the <Picker /> component
 */
export var createPickerColumns = function createPickerColumns(date, config) {
  if (config === void 0) {
    config = {};
  }
  var defaultPickerFormat = DEFAULT_DATE_PICKER_COLUMN_FORMAT;
  var customPickerFormat;
  var currentMonth = date.getMonth() + 1;
  var currentYear = date.getFullYear();
  var _config2 = config,
    locale = _config2.locale;
  if (config.datePickerColumns && typeof config.datePickerColumns === "string" && COLUMN_FORMATS.map(function (k) {
    return k;
  }).includes(config.datePickerColumns.toUpperCase())) {
    customPickerFormat = config.datePickerColumns.toUpperCase();
  }
  var dateFormatArr = customPickerFormat ? customPickerFormat.split(/-|\/|\s|:/g) : defaultPickerFormat.split(/-|\/|\s|:/g);
  var _getDateRange2 = getDateRange(config.startDate, config.endDate),
    startDate = _getDateRange2.startDate,
    startMonth = _getDateRange2.startMonth,
    startYear = _getDateRange2.startYear,
    endDate = _getDateRange2.endDate,
    endMonth = _getDateRange2.endMonth,
    endYear = _getDateRange2.endYear;
  var _getPosition = getPosition({
      currentMonth: currentMonth,
      currentYear: currentYear,
      startDate: config.startDate,
      endDate: config.endDate
    }),
    isEndYear = _getPosition.isEndYear,
    isStartYear = _getPosition.isStartYear,
    isEndMonth = _getPosition.isEndMonth,
    isStartMonth = _getPosition.isStartMonth;
  var len = dateFormatArr.length;
  var columns = [];
  for (var i = 0; i < len; i += 1) {
    var f = dateFormatArr[i];
    if (f === "YYYY") {
      var years = {
        options: [],
        name: YEAR_COL_NAME
      };
      var start = startYear;
      var end = endYear;
      for (var j = start; j <= end; j += 1) {
        years.options.push({
          value: j.toString(),
          displayName: yearFormatter(locale).format(new Date().setFullYear(j))
        });
      }
      columns.push(years);
    } else if (f === "MM") {
      var months = {
        options: [],
        name: MONTH_COL_NAME
      };
      var _start = isStartYear ? startMonth : 1;
      var _end = isEndYear ? endMonth : 12;
      if (isStartYear) {
        _start = Number.parseInt(startMonth.toString(), 10);
      }
      if (isEndYear) {
        _end = Number.parseInt(endMonth.toString(), 10);
      }
      for (var k = _start; k <= _end; k += 1) {
        months.options.push({
          value: k.toString(),
          displayName: monthFormatter(locale).format(new Date("0001-01-01").setMonth(k - 1))
        });
      }
      columns.push(months);
    } else if (f === "DD") {
      var days = {
        options: [],
        name: DATE_COL_NAME
      };
      var _end2 = getMonthlyDay(currentYear, currentMonth);
      var _start2 = 1;
      if (isStartMonth && startDate) {
        _start2 = startDate;
      }
      if (isEndMonth) {
        _end2 = endDate;
      }
      for (var l = _start2; l <= _end2; l += 1) {
        days.options.push({
          value: l.toString(),
          displayName: dayFormatter(locale).format(new Date("0001-01-01").setDate(l))
        });
      }
      columns.push(days);
    }
  }
  return columns;
};