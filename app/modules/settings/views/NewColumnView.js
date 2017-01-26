define([
  'app',
  'underscore',
  'backbone',
  'core/edit',
  'core/Modal',
  'helpers/schema',
  'core/t'
], function(app, _, Backbone, EditView, ModalView, SchemaHelper, __t) {

  return ModalView.extend({

    attributes: {
      class: 'modal column'
    },

    template: 'modal/columns-new',

    events: {
      'change select#dataType': function(e) {
        this.selectedDataType = $(e.target).val();
        this.render();
      },

      'change select#uiType': function(e) {
        var columnName = this.model.get('column_name');
        var columnComment = this.model.get('comment');

        this.model.clear();
        this.model.set({
          column_name: columnName,
          comment: columnComment
        });
        this.selectedUI = $(e.target).val();
        this.selectedDataType = null;
        this.render();
      },

      'change input#columnName': function(e) {
        this.columnName =  $(e.target).val();
        this.model.set({column_name: this.columnName});
      },

      'change input#comment': function(e) {
        this.comment =  $(e.target).val();
        this.model.set({comment: this.comment});
      },

      'change input#length': function(e) {
        this.model.set({length: $(e.target).val()});
      },

      'change input#defaultValue': function(e) {
        this.model.set({default_value: $(e.target).val()});
      },

      'change select#relatedTable': function(e) {
        this.model.set({related_table: $(e.target).val()});
        this.render();
      },

      'change #junctionKeyRight': function(e) {
        this.model.set({junction_key_right: $(e.target).val()});
      },

      'change #junctionKeyLeft': function(e) {
        this.model.set({junction_key_left: $(e.target).val()});
      },

      'change #tableJunction': function(e) {
        this.model.set({junction_table: $(e.target).val()});
        this.render();
      },

      'click .js-cancel': '_close',

      'click .js-save': 'save'
    },

    _close: function() {
      // change Modal.close to Modal._close
      // change this._close to this.close
      // closing the modal should close it from their container
      this.container.close();
    },

    save: function() {
      var data = this.$('form').serializeObject();
      var options = {patch: false};

      this.listenTo(this.model, 'sync', function(model) {
        console.log(model);
        this.model.collection.add(model);
      }, this);


      if (!this.model.isNew()) {
        data = this.model.unsavedAttributes();
        options.patch = true;
        this.model.stopTracking();
      }

      if (data) {
        this.model.save(data, options);
        this._close();
      }
    },

    serialize: function() {
      var UIManager = require('core/UIManager');
      var tables;
      var tableRelated;
      var uis = _.clone(UIManager._getAllUIs());
      var data = {
        ui_types: [],
        data_types: [],
        column_name: this.model.get('column_name'),
        comment: this.model.get('comment'),
        default_value: this.model.get('default_value'),
        hideColumnName: this.hideColumnName
      };

      if (_.isFunction(this.uiFilter)) {
        _.each(uis, function(value, key) {
          if (this.uiFilter(value) !== true) {
            delete uis[key];
          }
        }, this);
      }

      for (var key in uis) {
        //If not system column
        if( key.indexOf('directus_') < 0 ) {
          if(!this.selectedUI) {
            this.selectedUI = key;
          }

          var item = {title: key};

          if(this.selectedUI === key) {
            item.selected = true;
          }

          data.ui_types.push(item);
        }
      }

      data.ui_types.sort(function(a, b) {
        a = a.title.toLowerCase();
        b = b.title.toLowerCase();

        if (a < b) {
          return -1;
        }

        if (a > b) {
          return 1;
        }

        return 0;
      });

      var that = this;
      uis[this.selectedUI].dataTypes.forEach(function(dataType) {
        var item = {title: dataType};
        if (['MANYTOMANY', 'ONETOMANY'].indexOf(dataType) >= 0) {
          item.value = 'ALIAS';
        }

        if (!that.selectedDataType) {
          that.selectedDataType = dataType;
        }

        if (dataType === that.selectedDataType) {
          item.selected = true;
        }

        data.data_types.push(item);
      });

      // Check if the data type needs length
      // ENUM and SET doesn't actually needs a LENGTH,
      // but the "length" value is a list of string separate by comma
      if (['VARCHAR', 'CHAR', 'ENUM', 'SET'].indexOf(this.selectedDataType) > -1) {
        data.SHOW_LENGTH = true;
        if (!this.model.get('length')) {
          var length = ['ENUM', 'SET'].indexOf(this.selectedDataType) > -1 ? '' : 100;
          this.model.set({length: length});
        }
        data.length = this.model.get('length');
      } else {
        delete data.length;
        if (this.model.has('length')) {
          this.model.unset('length', {silent: true});
        }
      }

      if (['many_to_one', 'single_file', 'many_to_one_typeahead'].indexOf(this.selectedUI) > -1) {
        data.MANYTOONE = true;
        tableRelated = this.getRelatedTable();//this.model.get('related_table');
        this.model.set({junction_key_right: this.columnName});

        if (this.selectedUI === 'single_file') {
          tables = [{id: 'directus_files', selected: true}];
        } else {
          tables = app.schemaManager.getTables();
          tables = tables.map(function(model) {
            if (!tableRelated) {
              tableRelated = model.id;
              this.model.set({related_table: model.id});
            }
            return {id: model.get('table_name'), selected: (model.id === this.model.get('related_table'))};
          }, this);
        }

        data.columns_right = [{column_name: (this.columnName || __t('this_column')), selected: true}];

        var tableModel = app.schemaManager.getTable(tableRelated);
        data.columns_left = app.schemaManager.getColumns('tables', tableRelated).filter(function(model) {
          return tableModel.get('primary_column') === model.id;
        }, this).map(function(model){
          return {column_name: model.id, selected: (model.id === junctionKeyRight)};
        });

        data.disabledJunctionKeyRight = true;

        data.tables = tables;
      }

      //If Single_file UI, force related table to be directus_files
      if (['single_file', 'multiple_files'].indexOf(this.selectedUI) > -1) {
        this.model.set({related_table: 'directus_files'});
        data.disabledTableRelated = true;
      }

      if (['ONETOMANY', 'MANYTOMANY'].indexOf(this.selectedDataType) > -1) {
        data[this.selectedDataType] = true;
        data.selectedRelationshipType = this.selectedRelationshipType = this.selectedDataType;
        this.isAlias = true;

        tableRelated = this.model.get('related_table');
        var junctionTable = this.model.get('junction_table');
        var junctionKeyRight = this.model.get('junction_key_right');

        // List of junction tables
        tables = app.schemaManager.getTables();
        tables = tables.map(function (model) {
          if (!tableRelated) {
            tableRelated = model.id;
            this.model.set({related_table: model.id});
          }
          return {id: model.get('table_name'), selected: (model.id === this.model.get('related_table'))};
        }, this);

        data.tables = tables;

        if (this.selectedDataType === 'MANYTOMANY') {
          data.junctionTables = _.chain(tables)
            .map(function(model) {
              if(!junctionTable){
                junctionTable = model.id;
                this.model.set({junction_table: model.id});
              }
              return {id: model.id, selected: (model.id === this.model.get('junction_table'))};
            }, this).value();

          if (junctionTable !== undefined) {
            var junctionTables = app.schemaManager.getColumns('tables', junctionTable);
            var junctionTableModel = app.schemaManager.getTable(junctionTable);
            var filterPrimary = function(model) {
              return junctionTableModel.get('primary_column') !== model.id;
            };
            data.junction_columns_left = junctionTables.filter(filterPrimary).map(function(model) {
              return {column_name: model.id, selected: (model.id === this.model.get('junction_key_left'))};
            }, this);
            data.junction_columns_right = junctionTables.filter(filterPrimary).map(function(model) {
              return {column_name: model.id, selected: (model.id === this.model.get('junction_key_right'))};
            }, this);
          }

          // related table primary key
          tableName = this.collection.table.id;
          tableModel = app.schemaManager.getTable(tableName);
          data.columns_right = app.schemaManager.getColumns('tables', tableName).filter(function(model) {
            return true;
          }).map(function(model) {
            return {column_name: model.id, selected: (model.id === this.model.get('junction_key_left'))};
          }, this);

          // current table primary column
          data.columns_left = app.schemaManager.getColumns('tables', tableRelated).filter(function(model) {
            return true;
          }).map(function(model) {
            return {column_name: model.id, selected: (model.id === this.model.get('junction_key_left'))};
          }, this);
        } else {
          if (tableRelated !== undefined) {
            data.columns = app.schemaManager.getColumns('tables', tableRelated).map(function(model) {
              return {column_name: model.id, selected: (model.id === junctionKeyRight)};
            }, this);
          }

          // related table columns
          tableModel = tableModel = app.schemaManager.getTable(tableRelated);
          data.columns_left = app.schemaManager.getColumns('tables', tableRelated).filter(function(model) {
            return tableModel.get('primary_column') !== model.id;
          }, this).map(function(model){
            return {column_name: model.id, selected: (model.id === junctionKeyRight)};
          });

          // This column's table primary key
          var tableName = this.collection.table.id;
          tableModel = app.schemaManager.getTable(tableName);
          data.columns_right = app.schemaManager.getColumns('tables', tableName).filter(function(model) {
            return tableModel.get('primary_column') === model.id;
          }, this).map(function(model){
            return {column_name: model.id, selected: (model.id === junctionKeyRight)};
          });

          // hotfix: make sure the column exists in the junction table schema
          // @TODO: Verify that any other related/junction columns exists
          if (junctionKeyRight === undefined) {
            junctionKeyRight = '';
          }

          if (data.columns.length > 0) {
            var column = _.find(data.columns, function(column) {
              return column.column_name === junctionKeyRight;
            });

            if (column === undefined) {
              column = _.first(data.columns);
            }

            junctionKeyRight = column.column_name;
          }

          this.model.set({junction_key_right: junctionKeyRight});
        }

        this.model.set({relationship_type: this.selectedDataType});
      }

      var dataType = this.selectedDataType;
      if (this.isAlias === true) {
        dataType = 'ALIAS';
      }
      this.model.set({data_type: dataType, ui: this.selectedUI});

      data.isAlias = this.isAlias;
      data.isRelational = data.MANYTOONE || data.MANYTOMANY || data.ONETOMANY || false;

      return data;
    },

    isValid: function() {
      return this.model.has('column_name');
    },

    getRelatedTable: function() {
      var relatedTable = this.model.get('related_table');

      if (relatedTable) {
        return relatedTable;
      }

      // List of junction tables
      var tables = app.schemaManager.getTables();
      tables.each(function (model) {
        if (!relatedTable) {
          relatedTable = model.id;
        }
      }, this);

      return relatedTable;
    },

    afterRender: function() {
      var $el = this.$el;
      var $inputColumnName = $el.find('input#columnName');
      var $strict = $el.find('#strictNaming');
      var $valid = $el.find('#columnNameValid');

      $strict.on('change', function() {
        $valid.toggle();
      });

      $inputColumnName.on('change keypress paste focus textInput input', function() {
        var strictNaming = $strict.is(':checked');

        if (!strictNaming) {
          return;
        }

        var rawColumnName = $(this).val();
        var cleanColumnName = SchemaHelper.cleanColumnName(rawColumnName);
        // var columnNameText = '';

        if (cleanColumnName && rawColumnName !== cleanColumnName) {
          // columnNameText = __t('this_column_will_be_saved_as_x', {column_name: cleanColumnName});
          $valid.hide();
        } else {
          $valid.show();
        }

        // $el.find('#cleanColumnName').text(columnNameText);
        $el.find('#displayName').val(app.capitalize(cleanColumnName));
      });
    },

    initialize: function(options) {
      options = options || {};
      this.uiFilter = options.ui_filter || false;
      this.selectedUI = _.isString(this.model.get('ui')) ? this.model.get('ui') : undefined;
      this.selectedDataType = this.model.get('type') || undefined;
      this.selectedRelationshipType = this.model.get('relationship_type') || undefined;
      this.isAlias = ['ONETOMANY', 'MANYTOMANY'].indexOf(this.selectedRelationshipType) >= 0;
      if (this.isAlias) {
        this.selectedDataType = this.selectedRelationshipType;
      }
      this.columnName = this.model.get('column_name') || undefined;
      this.hideColumnName = (options.hiddenFields && options.hiddenFields.indexOf('column_name') >= 0);

      if (!this.model.isNew()) {
        this.model.startTracking();
      }

      this.render();
    }
  });
});
