import { default as computed, on } from 'ember-addons/ember-computed-decorators';
import { withPluginApi } from 'discourse/lib/plugin-api';
import DiscourseURL from 'discourse/lib/url';
import AppController from 'discourse/controllers/application';
import PreferencesInterface from "discourse/controllers/preferences/interface";
import { getOwner } from 'discourse-common/lib/get-owner';

export default {
  name: 'quick-messages-edits',
  initialize(){
    let user_quick_message_preference = 0;
    if ( Discourse.User ) {
      let cu = Discourse.User.current();
      if ( cu.custom_fields.show_quick_message ) {
        user_quick_message_preference = 1;
      }
    }

    if (Discourse.SiteSettings.quick_message_enabled && user_quick_message_preference) {
      withPluginApi('0.1', api => {
        api.decorateWidget('header-icons:before', function(helper) {
          const currentUser = api.getCurrentUser();
          const headerState = helper.widget.parentWidget.state;

          let contents = [];
          if (currentUser) {
            const unread = currentUser.get('unread_private_messages');
            contents.push(helper.attach('header-dropdown', {
              title: 'user.private_messages',
              icon: Discourse.SiteSettings.quick_message_icon,
              iconId: 'toggle-messages-menu',
              active: headerState.messagesVisible,
              action: 'toggleMessages',
              contents() {
                if (unread) {
                  return this.attach('link', {
                    action: 'toggleMessages',
                    className: 'badge-notification unread-private-messages',
                    rawLabel: `${unread}`
                  });
                }
              }
            }));
          }
          if (headerState.messagesVisible) {
            contents.push(helper.attach('messages-menu'));
          }
          return contents;
        });

        api.attachWidgetAction('header', 'toggleMessages', function() {
          this.state.messagesVisible = !this.state.messagesVisible;
        });

        api.attachWidgetAction('header', 'addToDocked', function(id) {
          this.messagesClicked();
          getOwner(this).lookup('controller:application').send('addToDocked', id);
        });

        api.attachWidgetAction('header', 'messagesClicked', function() {
          this.linkClickedEvent();
          this.state.messagesVisible = false;
        });

        api.attachWidgetAction('header', 'goToMessages', function() {
          this.messagesClicked();
          DiscourseURL.routeTo('/users/' + this.currentUser.get('username') + '/messages');
        });

        if (Discourse.SiteSettings.whos_online_enabled) {
          api.modifyClass('component:docked-post', {
            onlineService: Ember.inject.service('online-service')
          })
        }
      });

      PreferencesInterface.reopen({
        saveAttrNames: function() {
          const attrs = this._super(...arguments);
          if (!attrs.includes("custom_fields")) attrs.push("custom_fields");
          return attrs;
        }.property(),
        _updateShowQuickMessage: function() {
          const saved = this.get("saved");
          const currentUser = this.get("currentUser");

          if (saved && currentUser && this.get("model.id") == currentUser.get("id")) {
            currentUser.set("show_quick_message", this.get("model.custom_fields.show_quick_message"));
          }
        }.observes("saved")
      });

      AppController.reopen({
        docked: Ember.A(),

        @on('didInsertElement')
        _setupQuickMessages() {
          $(window).on('resize', Ember.run.bind(this, this.maxIndex));
        },

        @on('willDestroyElement')
        _teardownQuickMessages() {
          $(window).off('resize', Ember.run.bind(this, this.maxIndex));
        },

        @computed()
        maxIndex() {
          return this.site.mobileView ? 1 : Math.floor(($(window).width() - 390) / 340);
        },

        actions: {
          addToDocked(id) {
            id = id ? id : 'new';
            let docked = this.get('docked');

            if (docked.includes(id)) return;

            let max = this.get('maxIndex');
            if (docked.length >= max) {
              docked.replace(0, 1, id);
            } else {
              docked.pushObject(id);
            }
          },

          removeDocked(index) {
            this.get('docked').removeAt(index);
          },

          updateId(index, id) {
            const docked = this.get('docked');
            docked.replace(index, 1, id);
          }
        }
      });
    }
  }
};
