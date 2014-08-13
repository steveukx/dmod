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
     * @return {Q.Promise}
     */
    SQLite.prototype.create = function (model) {
        return this._run(merge('CREATE TABLE IF NOT EXISTS `%s` (%s)',
                model.tableName,
                model.columnsStore.toSql())).then(function () { return model; });
    };

    /**
     * Persists changes to a record to the database, assumed to always be an update request as the model was created
     * from the result of a query rather than an arbitrary creation.
     *
     * @param {DMod.Model} model
     * @param {Object} record
     * @param {Object} changes
     * @param {Function} [onSave]
     */
    SQLite.prototype.updateRecord = function(model, record, changes, onSave) {
        return this._update(record, changes, model.tableName, model.columnsStore, model.getUniqueFields()).then(onSave);
    };

    /**
     * Handles the update of an existing record.
     *
     * @param record
     * @param changes
     * @param tableName
     * @param columns
     * @param uniqueFields
     * @returns {Q.Promise}
     */
    SQLite.prototype._update = function(record, changes, tableName, columns, uniqueFields) {
        var params = [];
        var updates = Object.keys(changes).map(function (fieldName) {
            params.push(changes[fieldName]);
            return merge('`%s` = ?', fieldName);
        });
        var key = uniqueFields.map(function (field) {
            params.push(record.originalValue(field));
            return merge('`%s` = ?', field);
        });

        var query = merge('update `%s` set %s WHERE %s', tableName, updates.join(', '), key.join(' AND '));
        return this._run(query, params, function (err) {
            console.log(arguments)
        });
    };

    /**
     * Persists a record to the database, assumed to always be an insert request as the original model was created
     * arbitrarily rather than being created from a query.
     *
     * @param {DMod.Model} model
     * @param {Object} record
     * @param {Object} changes
     * @param {Function} [onSave]
     */
    SQLite.prototype.createRecord = function(model, record, changes, onSave) {
        return this._insert(record, model.tableName, model.columnsStore.get()).then(onSave);
    };

    /**
     * Handles the insertion of a record.
     *
     * @param record
     * @param tableName
     * @param columns
     * @returns {Q.Promise}
     */
    SQLite.prototype._insert = function(record, tableName, columns) {
        var deferred = Q.defer();
        var params = [];
        var placeHolders = [];

        var valueFields = columns.filter(function (column) {
            return record.hasOwnProperty(column.key) && record[column.key] !== undefined;
        }).map(function (column) {
            if (column.association && typeof record[column.key] === "object") {
                params.push(record[column.key].id);
            }
            else {
                params.push(record[column.key]);
            }
            placeHolders.push('?');
            return column.key;
        });

        var query = merge('INSERT INTO `%s` (`%s`) VALUES (%s)',
            tableName, valueFields.join('`, `'), placeHolders.join());

        var db = this._database;
        var sqlite = this;

        db.serialize(function() {
            sqlite._run('BEGIN TRANSACTION');
            sqlite._run(query, params);

            db.get('SELECT last_insert_rowid() as id', function (err, row) {
                record.commitChanges(record.id = row.id);
                sqlite._run('END TRANSACTION');

                if (err) {
                    deferred.reject(err);
                }
                else {
                    deferred.resolve(record);
                }
            });
        });

        return deferred.promise;
    };

    /**
     * Runs a query. If the last argument is an array, it will be used as variable data to be merged into the query
     * by SQLite. Any arguments after the query string itself are used as sprintf arguments to be merged into the string
     * before it is sent to SQLite.
     *
     * @param {string} query
     * @return {Q.Promise}
     */
    SQLite.prototype._run = function(query) {
        var queryParams = [];
        var args = [].slice.call(arguments);
        var defer = Q.defer();
        var onDone;

        // optionally support a trailing onDone handler
        if (args.length > 1 && typeof args[args.length - 1] === "function") {
            onDone = args.pop();
        }

        // optionally support a trailing array of merge params
        if (args.length > 1 && Array.isArray(args[args.length - 1])) {
            queryParams = args.pop();
        }

        if (args.length > 1) {
            query = merge.apply(this, args);
        }

        this._logQuery(query, queryParams);

        this._database.run(query, queryParams, function (err) {
            if (onDone) {
                onDone(err);
            }

            if (err) {
                defer.reject(err);
            }
            else {
                defer.resolve();
            }
        });

        return defer.promise;
    };

    /**
     *
     * @param {string} query
     * @param {string[]} params
     * @param {Function} [then]
     * @returns {Q.promise}
     */
    SQLite.prototype._one = function(query, params, then) {
        var deferred = Q.defer();
        if (typeof then === "function") {
            deferred.promise.then(then);
        }

        this._database.query(query, params || [], function (err, result) {
            if (err) {
                deferred.reject(err);
            }
            else {
                deferred.resolve(result || null);
            }
        });

        return deferred.promise;
    };

    SQLite.prototype.findRecord = function() {

    };

    /**
     * Finds al matching records for the search term and calls back to the `then` handler.
     *
     * @param {DMod.Model} model
     * @param {Object} search
     * @param {Function} then
     */
    SQLite.prototype.findRecords = function(model, search, then) {
        var params = [];
        var criteria = Object.keys(search).map(function (fieldName) {
            var query = '';

            if (typeof search[fieldName] === 'string') {
                params.push(search[fieldName]);
                query += merge('`%s` = ?', fieldName);
            }
            else {
                Object.keys(search[fieldName]).forEach(function (searchType) {
                    switch (searchType) {
                        case 'like':
                            params.push(search[fieldName]);
                            query += merge('`%s` like ?', fieldName);
                            break;

                        default:
                            throw new SyntaxError('Bad search type: ' + searchType);
                    }
                });
            }

            return query;
        });

        var sql = merge('select * from `%s` where %s', model.tableName, criteria.join(', '));

        this._logQuery(sql, params);
        this._database.all(sql, params, function (err, rows) {
            then(err, rows);
        });
    };

    /**
     * Prints to the log - to enable logging, add 'dmod' to the NODE_DEBUG environment variable
     * @function
     */
    SQLite.prototype._logQuery = process.env.NODE_DEBUG && process.env.NODE_DEBUG.toLowerCase().indexOf('dmod') >= 0 ?
        function(query, queryParams) {
            console.log('%s;', query);
            if (queryParams && queryParams.length) {
                console.log('  > ' + queryParams.join('\n  > '));
            }
        } : function () {};

}());
