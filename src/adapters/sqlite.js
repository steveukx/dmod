(function () {

    'use strict';

    module.exports = SQLite;

    var Database = require('sqlite3').Database;
    var merge = require('util').format;
    var Q = require('q');

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
     * Persists the changes to the
     * @param {DMod.Model} model
     * @param {Object} record
     * @param {Object} changes
     * @param {Function} [onSave]
     */
    SQLite.prototype.saveRecord = function(model, record, changes, onSave) {
        var query;
        var params = [];
        var uniqueField = model.getUniqueFields();
        var isChange = uniqueField.some(function (field) {
            return changes.hasOwnProperty(field);
        });
        var changedFields = Object.keys(changes).filter(function (fieldName) {
            return model.columnsStore.exists(fieldName);
        });

        if (isChange) {
            query = 'update `' + model.tableName + '` set ' + changedFields.map(function (fieldName) {
                            params.push(changes[fieldName]);
                            return fieldName + ' = ?';
                        }).join(', ') + ' WHERE ' + uniqueField.map(function (uniqueField) {
                            // TODO
                            return '1'
                        }).join(' AND ');
        }
        else {
            query = 'insert into `' + model.tableName + '` (`' + changedFields.join('`, `') + '`) VALUES (' +
                changedFields.map(function (fieldName) {
                    params.push(changes[fieldName]);
                    return '?';
                }).join(', ') + ')';
        }

        console.log(query, params)
        this._run(query, params, function (err, res) {
            console.log(arguments)
        });
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

//        TODO: include a pending queries count, on zero fire event
//        TODO: that says queries done, use that to decide when to start running queries
//        TODO: from the DMod wrapper

        var queryParams = [];
        var args = [].slice.call(arguments);
        var defer = Q.defer();

        if (args.length > 1 && Array.isArray(args[args.length - 1])) {
            queryParams = args.pop();
        }

        if (args.length > 1) {
            query = merge.apply(this, args);
        }

        console.log(query, ';');

        this._database.run(query, queryParams, function (err) {
            if (err) {
                defer.reject(err);
            }
            else {
                defer.resolve();
            }
        });

        return defer.promise;
    };

}());
