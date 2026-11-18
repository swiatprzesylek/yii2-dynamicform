/**
 * yii2-dynamic-form
 *
 * A jQuery plugin to clone form elements in a nested manner, maintaining accessibility.
 *
 * @author Wanderson Bragança <wanderson.wbc@gmail.com>
 */
(function ($) {
    var pluginName = 'yiiDynamicForm';

    var regexID = /^(.+?)([-\d-]{1,})(.+)$/i;

    var regexName = /(^.+?)([\[\d{1,}\]]{1,})(\[.+\]$)/i;

    $.fn.yiiDynamicForm = function (method) {
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error('Method ' + method + ' does not exist on jQuery.yiiDynamicForm');
            return false;
        }
    };

    var events = {
        beforeInsert: 'beforeInsert',
        afterInsert: 'afterInsert',
        beforeDelete: 'beforeDelete',
        afterDelete: 'afterDelete',
        limitReached: 'limitReached'
    };

    var methods = {
        init: function (widgetOptions) {
            var $containers = $('.' + widgetOptions.widgetContainer);
            var shouldParseTemplate = !$containers.length;

            $containers.each(function () {
                var $container = $(this);
                if (!$container.data(pluginName)) {
                    $container.data(pluginName, true);
                    shouldParseTemplate = true;
                }
            });

            if (shouldParseTemplate && !widgetOptions._templateParsed) {
                widgetOptions.template = _parseTemplate(widgetOptions);
                widgetOptions._templateParsed = true;
            }

            return this;
        },

        refresh: function (widgetOptions) {
            widgetOptions.template = _removeErrorSuccessClasses($(widgetOptions.template), widgetOptions);
            return this;
        },

        addItem: function (widgetOptions, e, $elem) {
           _addItem(widgetOptions, e, $elem);
        },

        deleteItem: function (widgetOptions, e, $elem) {
           _deleteItem(widgetOptions, e, $elem);
        },

        updateContainer: function () {
            var widgetOptions = eval($(this).attr('data-dynamicform'));
            var validationSnapshot = _detachFormValidation(widgetOptions);
            _updateAttributes(widgetOptions);
            _restoreSpecialJs(widgetOptions);
            _restoreFormValidation(widgetOptions, validationSnapshot);
        }
    };

    var _getActiveForm = function(widgetOptions) {
        var $form = $(document.getElementById(widgetOptions.formId));

        if (!$form.length || typeof $form.yiiActiveForm !== 'function') {
            return null;
        }

        var data = $form.data('yiiActiveForm');
        if (!data || !$.isArray(data.attributes)) {
            return null;
        }

        return {
            $form: $form,
            data: data
        };
    };

    var _removeErrorSuccessClasses = function($template, widgetOptions) {
        var activeForm = _getActiveForm(widgetOptions);

        if (activeForm && activeForm.data.settings) {
            var $elements = $template.find('*').addBack();
            if (activeForm.data.settings.errorCssClass) {
                $elements.removeClass(activeForm.data.settings.errorCssClass);
            }
            if (activeForm.data.settings.successCssClass) {
                $elements.removeClass(activeForm.data.settings.successCssClass);
            }
        }

        return $template;
    };

    var _parseTemplate = function(widgetOptions) {

        var $template = $(widgetOptions.template);
        $template.find('div[data-dynamicform]').each(function(){
            var widgetOptions = eval($(this).attr('data-dynamicform'));
            if ($(widgetOptions.widgetItem).length > 1) {
                var item = $(this).find(widgetOptions.widgetItem).first()[0].outerHTML;
                $(this).find(widgetOptions.widgetBody).html(item);
            }
        });

        $template.find('input, textarea, select').each(function() {
            if ($(this).is(':checkbox') || $(this).is(':radio')) {
                var type         = ($(this).is(':checkbox')) ? 'checkbox' : 'radio';
                var inputName    = $(this).attr('name');
                var $inputHidden = $template.find('input[type="hidden"][name="' + inputName + '"]').first();
                var count        = $template.find('input[type="' + type +'"][name="' + inputName + '"]').length;

                if ($inputHidden && count === 1) {
                    $(this).val(1);
                    $inputHidden.val(0);
                }

                $(this).prop('checked', false);
            } else if($(this).is('select')) {
                $(this).find('option:selected').removeAttr("selected");
            } else {
                $(this).val(''); 
            }
        });

        return _removeErrorSuccessClasses($template, widgetOptions);
    };

    var _getWidgetOptionsRoot = function(widgetOptions) {
        return eval($(widgetOptions.widgetBody).parents('div[data-dynamicform]').last().attr('data-dynamicform'));
    };

    var _getLevel = function($elem) {
        var level = $elem.parents('div[data-dynamicform]').length;
        level = (level < 0) ? 0 : level;
        return level;
    };

    var _count = function($elem, widgetOptions) {
        return $elem.closest('.' + widgetOptions.widgetContainer).find(widgetOptions.widgetItem).length;
    };

    var _createIdentifiers = function(level) {
        return new Array(level + 2).join('0').split('');
    };

    var _addItem = function(widgetOptions, e, $elem) {
        var count = _count($elem, widgetOptions);

        if (count < widgetOptions.limit) {
            var validationSnapshot = _detachFormValidation(widgetOptions);
            var $toclone = _removeErrorSuccessClasses($(widgetOptions.template), widgetOptions);
            var $newclone = $toclone.clone(false, false);

            if (widgetOptions.insertPosition === 'top') {
                $elem.closest('.' + widgetOptions.widgetContainer).find(widgetOptions.widgetBody).prepend($newclone);
            } else {
                $elem.closest('.' + widgetOptions.widgetContainer).find(widgetOptions.widgetBody).append($newclone);
            }

            _updateAttributes(widgetOptions);
            _restoreSpecialJs(widgetOptions);
            _restoreFormValidation(widgetOptions, validationSnapshot);
            $elem.closest('.' + widgetOptions.widgetContainer).triggerHandler(events.afterInsert, $newclone);
        } else {
            // trigger a custom event for hooking
            $elem.closest('.' + widgetOptions.widgetContainer).triggerHandler(events.limitReached, widgetOptions.limit);
        }
    };

    var _deleteItem = function(widgetOptions, e, $elem) {
        var count = _count($elem, widgetOptions);

        if (count > widgetOptions.min) {
            var $todelete = $elem.closest(widgetOptions.widgetItem);

            // trigger a custom event for hooking
            var $widget = $elem.closest('.' + widgetOptions.widgetContainer);
            var eventResult = $widget.triggerHandler(events.beforeDelete, $todelete);
            if (eventResult !== false) {
                var validationSnapshot = _detachFormValidation(widgetOptions);
                $todelete.remove();
                _updateAttributes(widgetOptions);
                _restoreSpecialJs(widgetOptions);
                _restoreFormValidation(widgetOptions, validationSnapshot);
                $widget.triggerHandler(events.afterDelete);
            }
        }
    };

    var _updateAttrID = function($elem, index) {
        var widgetOptions = eval($elem.closest('div[data-dynamicform]').attr('data-dynamicform'));
        var id            = $elem.attr('id');
        var newID         = id;

        if (id !== undefined) {
            var matches = id.match(regexID);
            if (matches && matches.length === 4) {
                matches[2] = matches[2].substring(1, matches[2].length - 1);
                var identifiers = matches[2].split('-');
                identifiers[0] = index;
                
                if (identifiers.length > 1) {
                    var widgetsOptions = [];
                    $elem.parents('div[data-dynamicform]').each(function(i){
                        widgetsOptions[i] = eval($(this).attr('data-dynamicform'));
                    });

                    widgetsOptions = widgetsOptions.reverse();
                    for (var i = identifiers.length - 1; i >= 1; i--) {
                        if(typeof widgetsOptions[i] !== 'undefined') {
                            identifiers[i] = $elem.closest(widgetsOptions[i].widgetItem).index();
                        }
                    }
                }

                newID = matches[1] + '-' + identifiers.join('-') + '-' + matches[3];
                $elem.attr('id', newID);
            } else {
                newID = id + index;
                $elem.attr('id', newID);
            }
        }

        if (id !== newID) {
            $elem.closest(widgetOptions.widgetItem).find('.field-' + id).each(function() {
                $(this).removeClass('field-' + id).addClass('field-' + newID);
            });
            // update "for" attribute
            $elem.closest(widgetOptions.widgetItem).find("label[for='" + id + "']").attr('for',newID); 
        }

        return newID;
    };

    var _updateAttrName = function($elem, index) {
        var name = $elem.attr('name');

        if (name !== undefined) {
            var matches = name.match(regexName);

            if (matches && matches.length === 4) {
                matches[2] = matches[2].replace(/\]\[/g, "-").replace(/\]|\[/g, '');
                var identifiers = matches[2].split('-');
                identifiers[0] = index;

                if (identifiers.length > 1) {
                    var widgetsOptions = [];
                    $elem.parents('div[data-dynamicform]').each(function(i){
                        widgetsOptions[i] = eval($(this).attr('data-dynamicform'));
                    });

                    widgetsOptions = widgetsOptions.reverse();
                    for (var i = identifiers.length - 1; i >= 1; i--) {
                        if(typeof widgetsOptions[i] !== 'undefined') {
                            identifiers[i] = $elem.closest(widgetsOptions[i].widgetItem).index();
                        }

                    }
                }

                name = matches[1] + '[' + identifiers.join('][') + ']' + matches[3];
                $elem.attr('name', name);
            }
        }

        return name;
    };

    var _updateAttributes = function(widgetOptions) {
        var widgetOptionsRoot = _getWidgetOptionsRoot(widgetOptions);

        $(widgetOptionsRoot.widgetItem).each(function(index) {
            var $item = $(this);
            $(this).find('*').each(function() {
                // update "id" attribute
                _updateAttrID($(this), index);

                // update "name" attribute
                _updateAttrName($(this), index);
            });
        });
    };

    var _getWidgetBody = function(widgetOptions) {
        var $container = $('.' + widgetOptions.widgetContainer);
        return $container.filter(widgetOptions.widgetBody).add($container.find(widgetOptions.widgetBody));
    };

    var _validationKey = function(id) {
        if (typeof id !== 'string') {
            return null;
        }

        return id.replace(/-\d+(?=-|$)/g, '-{}');
    };

    var _findAttributeInput = function($form, attribute) {
        var input = attribute.id ? document.getElementById(attribute.id) : null;

        if (!input && typeof attribute.input === 'string') {
            try {
                input = $form.find(attribute.input).first()[0];
            } catch (ignore) {
                input = null;
            }
        }

        return input;
    };

    var _findAttribute = function(attributes, id) {
        var result;

        $.each(attributes, function() {
            if (this.id === id) {
                result = this;
                return false;
            }
        });

        return result;
    };

    var _detachFormValidation = function(widgetOptions) {
        var activeForm = _getActiveForm(widgetOptions);
        if (!activeForm) {
            return null;
        }

        var widgetOptionsRoot = _getWidgetOptionsRoot(widgetOptions);
        var $widgetBody = _getWidgetBody(widgetOptionsRoot);
        var templateKeys = {};

        $(widgetOptionsRoot.template).find('input, textarea, select').each(function() {
            if (this.id) {
                templateKeys[_validationKey(this.id)] = true;
            }
        });

        var snapshot = {
            $form: activeForm.$form,
            entries: [],
            templates: widgetOptionsRoot._validationTemplates || {}
        };

        activeForm.data.attributes.slice().forEach(function(attribute) {
            var input = _findAttributeInput(activeForm.$form, attribute);
            var key = _validationKey(attribute.id);
            var isWidgetInput = input && ($widgetBody.is(input) || $widgetBody.has(input).length);

            if (!isWidgetInput && (input || !templateKeys[key])) {
                return;
            }

            var entry = {
                attribute: $.extend(true, {}, attribute),
                input: input
            };
            snapshot.entries.push(entry);
            if (key !== null && snapshot.templates[key] === undefined) {
                snapshot.templates[key] = entry.attribute;
            }
        });

        widgetOptionsRoot._validationTemplates = snapshot.templates;

        snapshot.entries.forEach(function(entry) {
            if (_findAttribute(activeForm.data.attributes, entry.attribute.id) !== undefined) {
                activeForm.$form.yiiActiveForm('remove', entry.attribute.id);
            }
        });

        return snapshot;
    };

    var _replaceAttributeId = function(selector, oldId, newId) {
        if (typeof selector !== 'string' || !oldId) {
            return selector;
        }

        return selector.split(oldId).join(newId);
    };

    var _restoreFormValidation = function(widgetOptions, snapshot) {
        var activeForm = _getActiveForm(widgetOptions);
        if (!snapshot || !activeForm || snapshot.$form[0] !== activeForm.$form[0]) {
            return;
        }

        var widgetOptionsRoot = _getWidgetOptionsRoot(widgetOptions);
        var added = {};

        _getWidgetBody(widgetOptionsRoot).find('input, textarea, select').each(function() {
            var input = this;
            var id = input.id;
            var name = input.name;

            if (!id || !name || added[id]) {
                return;
            }

            var sourceAttribute;
            $.each(snapshot.entries, function() {
                if (this.input === input) {
                    sourceAttribute = this.attribute;
                    return false;
                }
            });

            if (sourceAttribute === undefined) {
                sourceAttribute = snapshot.templates[_validationKey(id)];
            }
            if (sourceAttribute === undefined) {
                return;
            }

            var attribute = $.extend(true, {}, sourceAttribute);
            var oldId = attribute.id;
            attribute.id = id;
            attribute.container = _replaceAttributeId(attribute.container, oldId, id);
            attribute.input = _replaceAttributeId(attribute.input, oldId, id);
            attribute.name = name;
            attribute.value = $(input).val();
            attribute.status = 0;

            if (_findAttribute(activeForm.data.attributes, id) !== undefined) {
                activeForm.$form.yiiActiveForm('remove', id);
            }
            activeForm.$form.yiiActiveForm('add', attribute);
            added[id] = true;
        });
    };

    var _restoreKrajeeDepdrop = function($elem) {
        var configDepdrop = $.extend(true, {}, eval($elem.attr('data-krajee-depdrop')));
        var inputID = $elem.attr('id');
        var matchID = inputID.match(regexID);

        if (matchID && matchID.length === 4) {
            for (index = 0; index < configDepdrop.depends.length; ++index) {
                var match = configDepdrop.depends[index].match(regexID);
                if (match && match.length === 4) {
                    configDepdrop.depends[index] = match[1] + matchID[2] + match[3];
                }
            }
        }

        $elem.depdrop(configDepdrop);
    };

    var _restoreSpecialJs = function(widgetOptions) {
        var widgetOptionsRoot = _getWidgetOptionsRoot(widgetOptions);

        // "jquery.inputmask"
        var $hasInputmask = $(widgetOptionsRoot.widgetItem).find('[data-plugin-inputmask]');
        if ($hasInputmask.length > 0) {
            $hasInputmask.each(function() {
                $(this).inputmask('remove');
                $(this).inputmask(eval($(this).attr('data-plugin-inputmask')));
            });
        }

        // "kartik-v/yii2-widget-datepicker"
        var $hasDatepicker = $(widgetOptionsRoot.widgetItem).find('[data-krajee-kvdatepicker]');
        if ($hasDatepicker.length > 0) {
            $hasDatepicker.each(function() {
                $(this).parent().removeData().kvDatepicker('destroy');
                $(this).parent().kvDatepicker(eval($(this).attr('data-krajee-kvdatepicker')));
            });
        }

        // "kartik-v/yii2-widget-timepicker"
        var $hasTimepicker = $(widgetOptionsRoot.widgetItem).find('[data-krajee-timepicker]');
        if ($hasTimepicker.length > 0) {
            $hasTimepicker.each(function() {
                $(this).removeData().off();
                $(this).parent().find('.bootstrap-timepicker-widget').remove();
                $(this).unbind();
                $(this).timepicker(eval($(this).attr('data-krajee-timepicker')));
            });
        }

        // "kartik-v/yii2-money"
        var $hasMaskmoney = $(widgetOptionsRoot.widgetItem).find('[data-krajee-maskMoney]');
        if ($hasMaskmoney.length > 0) {
            $hasMaskmoney.each(function() {
                $(this).parent().find('input').removeData().off();
                var id = '#' + $(this).attr('id');
                var displayID  = id + '-disp';
                $(displayID).maskMoney('destroy');
                $(displayID).maskMoney(eval($(this).attr('data-krajee-maskMoney')));
                $(displayID).maskMoney('mask', parseFloat($(id).val()));
                $(displayID).on('change', function () {
                    var numDecimal = $(displayID).maskMoney('unmasked')[0];
                    $(id).val(numDecimal);
                    $(id).trigger('change');
                });
            });
        }

        // "kartik-v/yii2-widget-fileinput"
        var $hasFileinput = $(widgetOptionsRoot.widgetItem).find('[data-krajee-fileinput]');
        if ($hasFileinput.length > 0) {
            $hasFileinput.each(function() {
                $(this).fileinput(eval($(this).attr('data-krajee-fileinput')));
            });
        }

        // "kartik-v/yii2-widget-touchspin"
        var $hasTouchSpin = $(widgetOptionsRoot.widgetItem).find('[data-krajee-TouchSpin]');
        if ($hasTouchSpin.length > 0) {
            $hasTouchSpin.each(function() {
                $(this).TouchSpin('destroy');
                $(this).TouchSpin(eval($(this).attr('data-krajee-TouchSpin')));
            });
        }

        // "kartik-v/yii2-widget-colorinput"
        var $hasSpectrum = $(widgetOptionsRoot.widgetItem).find('[data-krajee-spectrum]');
        if ($hasSpectrum.length > 0) {
            $hasSpectrum.each(function() {
                var id = '#' + $(this).attr('id');
                var sourceID  = id + '-source';
                $(sourceID).spectrum('destroy');
                $(sourceID).unbind();
                $(id).unbind();
                var configSpectrum = eval($(this).attr('data-krajee-spectrum'));
                configSpectrum.change = function (color) {
                    jQuery(id).val(color.toString());
                };
                $(sourceID).attr('name', $(sourceID).attr('id'));
                $(sourceID).spectrum(configSpectrum);
                $(sourceID).spectrum('set', jQuery(id).val());
                $(id).on('change', function(){
                    $(sourceID).spectrum('set', jQuery(id).val());
                });
            });
        }

        // "kartik-v/yii2-widget-depdrop"
        var $hasDepdrop = $(widgetOptionsRoot.widgetItem).find('[data-krajee-depdrop]');
        if ($hasDepdrop.length > 0) {
            $hasDepdrop.each(function() {
                if ($(this).data('select2') === undefined) {
                    $(this).removeData().off();
                    $(this).unbind();
                    _restoreKrajeeDepdrop($(this));
                }
            });
        }

        // "kartik-v/yii2-widget-select2"
        var $hasSelect2 = $(widgetOptionsRoot.widgetItem).find('[data-krajee-select2]');
        if ($hasSelect2.length > 0) {
            $hasSelect2.each(function() {
                var id = $(this).attr('id');
                var configSelect2 = eval($(this).attr('data-krajee-select2'));

                if ($(this).data('select2')) {
                    $(this).select2('destroy');
                }

                var configDepdrop = $(this).data('depdrop');
                if (configDepdrop) {
                    configDepdrop = $.extend(true, {}, configDepdrop);
                    $(this).removeData().off();
                    $(this).unbind();
                    _restoreKrajeeDepdrop($(this));
                }

                $.when($('#' + id).select2(configSelect2)).done(initS2Loading(id, '.select2-container--krajee'));

                var kvClose = 'kv_close_' + id.replace(/\-/g, '_');

                $('#' + id).on('select2:opening', function(ev) {
                    initS2Loading(id, kvClose, ev);
                });

                $('#' + id).on('select2:unselect', function() {
                    window[kvClose] = true;
                });

               if (configDepdrop) {
                    var loadingText = (configDepdrop.loadingText) ? configDepdrop.loadingText : 'Loading ...';
                    initDepdropS2(id, loadingText);
                }
            });
        }

        // "kartik-v/yii2-widget-switchinput"
        var $hasSwitchinput = $(widgetOptionsRoot.widgetItem).find('[data-krajee-bootstrapswitch]');
        if ($hasSwitchinput.length > 0) {
            $hasSwitchinput.each(function() {
                $(this).bootstrapSwitch(eval($(this).attr('data-krajee-bootstrapswitch')));
            });
        }

        // "kartik-v/yii2-sortable"
        var $hasKvSortable = $(widgetOptionsRoot.widgetItem).find('[data-krajee-kvhtml5sortable]');
        if ($hasKvSortable.length > 0) {
            $hasKvSortable.each(function() {
                $(this).kvHtml5Sortable(eval($(this).attr('data-krajee-kvhtml5sortable')));
            });
        }
    };

})(window.jQuery);
