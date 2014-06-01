(function () {

    'use strict';

    module.exports = SQLite;

    var Database = require('sqlite3').Database;

    function SQLite (store) {
        this._database = new Database(store || ':memory:');
        this._database.run("PRAGMA foreign_keys = ON");
    }

}());
