(function () {

    'use strict';

    module.exports = ColumnDefinition;
    var merge = require('util').format;

    /**
     * The ColumnDefinition describes a single column in a table
     * @param {string} key
     * @constructor
     */
    function ColumnDefinition(key) {
        this.key = key;
    }

    /**
     * Gets the SQL string to use to describe this field in a CREATE statement
     * @returns {string}
     */
    ColumnDefinition.prototype.fieldSql = function() {
        var fieldConfig = merge('`%s` %s', this.key, ColumnDefinition.TYPES[this.type] || this.type);
        if (this.primaryKey) {
            fieldConfig += ' PRIMARY KEY';
        }
        if (this.autoIncrement) {
            fieldConfig += ' AUTOINCREMENT'
        }
        if (this.hasOwnProperty('defaultValue')) {
            fieldConfig += ' DEFAULT ' + (typeof this.defaultValue === 'string' ?
                '"' + this.defaultValue + '"' : this.defaultValue);
        }

        return fieldConfig;
    };

    /**
     * @type {string} the name of the field
     */
    ColumnDefinition.prototype.key = null;

    /**
     * @type {boolean} whether this field should be used as the primary key
     */
    ColumnDefinition.prototype.primaryKey = false;

    /**
     * @type {string} the type of the field
     */
    ColumnDefinition.prototype.type = 'text';

    /**
     * @type {string} name of the uniqueness constraint
     */
    ColumnDefinition.prototype.unique = null;

    /**
     * @ignore
     */
    ColumnDefinition.prototype._autoIncrement = false;

    /**
     * @name ColumnDefinition#autoIncrement
     * @type {boolean} whether this field should be auto incrementing - note when this is set to true,
     *                  field becomes an integer
     */
    Object.defineProperty(ColumnDefinition.prototype, 'autoIncrement', {
        get: function () { return this._autoIncrement; },
        set: function (val) { this._autoIncrement = val; if (val) {
            this.type = 'integer';
            this.primaryKey = true;
        }}
    });

    ColumnDefinition.TYPES = {
        INTEGER: 'integer',
        STRING: 'text',
        DECIMAL: 'number'
    }
}());

