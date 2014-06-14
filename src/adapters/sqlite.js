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
        this._run("PRAGMA foreign_keys = ON");
    }

    /**
     * Creates the table associated with a model
     * @param {DMod.Model} model
     */
    SQLite.prototype.create = function (model) {
        this._run(merge('CREATE TABLE IF NOT EXISTS `%s` (%s)',
            model.tableName,
            model.columnsStore.toSql()));
    };

    /**
     * Runs a query. If the last argument is an array, it will be used as variable data to be merged into the query
     * by SQLite. Any arguments after the query string itself are used as sprintf arguments to be merged into the string
     * before it is sent to SQLite.
     *
     * @param {string} query
     * @private
     */
    SQLite.prototype._run = function(query) {
        var queryParams = [];
        var args = [].slice.call(arguments);

        if (args.length > 1 && Array.isArray(args[args.length - 1])) {
            queryParams = args.pop();
        }

        if (args.length > 1) {
            query = merge.apply(this, args);
        }

        console.log(query, ';');
        this._database.run(query, queryParams);
    };

}());
