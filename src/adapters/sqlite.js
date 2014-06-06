(function () {

    'use strict';

    module.exports = SQLite;

    var Database = require('sqlite3').Database;
    var merge = require('util').format;

    /**
     * SQLite adapter for a DMod, when supplied the store parameter should be the path to the file the database
     * is persisted to, when omitted an in-memory database is used instead. Note that if the DMod is used across
     * multiple Node instances, each instance will have a separate in-memory database.
     *
     * @param {string} [store=:memory:]
     * @constructor
     */
    function SQLite (store) {
        this._database = new Database(store || ':memory:');
        this._database.run("PRAGMA foreign_keys = ON");
    }

    /**
     * Creates the table associated with a model
     * @param {DMod.Model} model
     */
    SQLite.prototype.create = function (model) {
        this._database.run(merge('CREATE TABLE IF NOT EXISTS `%s` (%s)',
            model.tableName, model.columnsStore.toSql()));
    };

}());
