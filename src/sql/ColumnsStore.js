(function() {

    'use strict';

    module.exports = ColumnsStore;
    var ForeignKeyConstraint = require('./ForeignKeyConstraint');
    var UniqueConstraint = require('./UniqueConstraint');

    /**
     * The ColumnStore is a cache of all columns being used in the table
     * @constructor
     */
    function ColumnsStore() {
        this._keys = {};
        this._items = [];
    }

    /**
     * Verifies whether the named column already exists in the collection of columns
     * @param {string} key
     * @returns {boolean}
     */
    ColumnsStore.prototype.exists = function(key) {
        return key in this._keys;
    };

    /**
     * Gets a ColumnDefinition based on its name. If not found, and `key` is supplied as a number, will attempt to
     * fetch the ColumnDefinition by index instead.
     * @param {string|number} key
     * @returns {ColumnDefinition|null}
     */
    ColumnsStore.prototype.get = function(key) {
        if (this._keys.hasOwnProperty(key)) {
            return this._items[this._keys[key]];
        }
        return (!isNaN(key) && this._items[key]) || null;
    };

    /**
     * Adds a column to the ColumnStore, when a ColumnDefinition of the same name already exists an error is thrown
     * @param {ColumnDefinition} column
     * @returns {ColumnsStore}
     */
    ColumnsStore.prototype.add = function(column) {
        if (!this.exists(column.key)) {
            this._keys[column.key] = this._items.push(column) - 1;
        }
        else {
            throw "Duplicate column definition";
        }
        return column;
    };

    /**
     * Runs a function against each ColumnDefinition in the ColumnsStore
     * @param {Function} fn
     * @param {object} [context]
     */
    ColumnsStore.prototype.forEach = function(fn, context) {
        this._items.forEach(fn, context || this);
    };

    /**
     * Runs a function against each ColumnDefinition in the ColumnsStore, returns the array of return values
     * @param {Function} fn
     * @param {object} [context]
     * @return {object[]}
     */
    ColumnsStore.prototype.map = function(fn, context) {
        return this._items.map(fn, context || this);
    };

    /**
     * Creates and returns the SQL string to use for the fields section of the CREATE statement when creating either
     * a table or view from this ColumnsStore
     * @returns {string}
     */
    ColumnsStore.prototype.toSql = function() {
        return this._items.map(ColumnsStore.toFieldSql)
            .concat(this.constraints())
            .join(', ');
    };

    /**
     * Gets an immutable array of TableConstraint instances that will be used by this Table
     * @returns {*|Array|string|Buffer|Blob}
     */
    ColumnsStore.prototype.constraints = function() {
        return this._items.reduce(function(constraints, columnDefinition) {
            var constraint;

            if (columnDefinition.unique) {
                var constraintId = 'unique_' + columnDefinition.unique;
                if (!constraints[constraintId]) {
                    constraints[constraintId] = new UniqueConstraint(columnDefinition.unique);
                }
                constraint = constraints[constraintId].add(columnDefinition.key);
            }

            if (columnDefinition.association) {
                constraint = columnDefinition.association;
            }

            if (constraint) {
                if (constraints.indexOf(constraint) < 0) {
                    constraints.push(constraint);
                }
            }

            return constraints;
        }, []).slice(0);
    };

    /**
     * Utility function to return the CREATE SQL string for a given ColumnDefinition
     * @param {ColumnDefinition} columnDefinition
     * @returns {string}
     */
    ColumnsStore.toFieldSql = function(columnDefinition) {
        return columnDefinition.fieldSql();
    };

}());

