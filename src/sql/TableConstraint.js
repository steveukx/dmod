(function () {

    'use strict';

    module.exports = TableConstraint;

    function TableConstraint(type, name) {
        this._type = type;
        this._name = name;
        this._fields = [];
    }

    TableConstraint.prototype.is = function(type) {
        return this._type === type;
    };

    TableConstraint.prototype.add = function(fieldName) {
        if (this._fields.indexOf(fieldName) < 0) {
            this._fields.push(fieldName);
        }
        return this;
    };

    TableConstraint.prototype._postString = function() {
        return '';
    };

    TableConstraint.prototype.toString = function() {
        return require('util').format('CONSTRAINT `%s` %s (`%s`) %s',
            this._name, this._type, this._fields.join('`, `'), this._postString());
    };

}());

