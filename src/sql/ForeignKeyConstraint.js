(function () {
    'use strict';

    module.exports = ForeignKeyConstraint;

    var TableConstraint = require('./TableConstraint');

    /**
     * The ForeignKeyConstraint represents a link between multiple tables.
     *
     * @param {string} name
     * @param {string} fieldName
     * @param {string} foreignTable
     * @constructor
     */
    function ForeignKeyConstraint (name, fieldName, foreignTable) {
        TableConstraint.call(this, 'FOREIGN KEY', 'ForeignKey' + name);
        this.add(fieldName.toLowerCase());
        this.foreignTable = foreignTable;
    }

    require('util').inherits(ForeignKeyConstraint, TableConstraint);

    Object.defineProperties(ForeignKeyConstraint.prototype, {
        /**
         * @type {string} Gets the field name of the constraint in this table, read-only
         */
        fieldName: {
            get: function() {
                return this._fields[0]
            }
        },

        /**
         * @type {string} Gets the name of the foreign table for use in SQL statements, read-only
         */
        sqlForeignTable: {
            get: function() {
                return this.foreignTable.toLowerCase() + 's';
            }
        }
    });

    /**
     * Gets the SQL suffix for this constraint
     * @returns {string}
     */
    ForeignKeyConstraint.prototype._postString = function() {
        return require('util').format('REFERENCES `%s` (`id`) ON DELETE CASCADE DEFERRABLE', this.sqlForeignTable);
    };

    /**
     * Gets/sets the model this ForeignKeyConstraint is an association to.
     *
     * @param {Object} model
     * @returns {ForeignKeyConstraint|Object}
     */
    ForeignKeyConstraint.prototype.model = function(model) {
        if (!arguments.length) {
            return this._model;
        }

        this._model = model;
        return this;
    };

}());
