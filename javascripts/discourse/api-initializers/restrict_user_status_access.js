import { apiInitializer } from "discourse/lib/api";
import { scheduleOnce } from "@ember/runloop";
import { getOwner } from "@ember/application";
import discourseComputed from "discourse-common/utils/decorators";

const PLUGIN_ID = "restrict-user-status";

export default apiInitializer("0.11.1", (api) => {
  const siteSettings = api.container.lookup("service:site-settings");
  const currentUser = api.container.lookup("service:current-user");

  if (!siteSettings.enable_user_status || !currentUser) {
    return;
  }

  const groupsIds = settings.allowed_groups.split("|").map((id) => Number(id));

  if (groupsIds.includes(0 /*everyone*/)) {
    return;
  }

  const userAllowed = ({ groups }) => {
    return groups
      ?.map((group) => Number(group.id))
      .some((id) => groupsIds.includes(id));
  };

  /**
   * Removes the status changer in the preferences page.
   */
  api.modifyClass("controller:preferences/account", {
    pluginId: PLUGIN_ID,

    @discourseComputed()
    canSelectUserStatus() {
      return userAllowed(this.currentUser);
    },
  });

  /**
   * Removes the status in the user card.
   */
  api.modifyClass("component:user-card-contents", {
    pluginId: PLUGIN_ID,

    @discourseComputed("user.status")
    hasStatus() {
      const hasStatus =
        this.siteSettings.enable_user_status && this.user.status;

      return this.user.id !== this.currentUser.id
        ? hasStatus
        : userAllowed(this.currentUser);
    },
  });

  /**
   * Removes the status in the new notification menu.
   * Without altering the template, I can't see others solutions.
   */
  if (
    siteSettings.navigation_menu !== "legacy" ||
    siteSettings.enable_new_notifications_menu
  ) {
    api.modifyClass("component:user-menu/menu-tab", {
      pluginId: PLUGIN_ID,

      removeUserStatus() {
        document.querySelector("li.set-user-status")?.remove();
      },

      get isActive() {
        const isActive = this.args.tab.id === this.args.currentTabId;

        if (
          isActive &&
          this.args.currentTabId === "profile" &&
          !userAllowed(getOwner(this).lookup("service:current-user"))
        ) {
          scheduleOnce("afterRender", this, "removeUserStatus");
        }

        return isActive;
      },
    });
  }

  /**
   * Hides the status emoji inside the avatar.
   */
  api.reopenWidget("user-status-bubble", {
    buildClasses(attrs) {
      if (!userAllowed(this.currentUser)) {
        return "hidden";
      }
    },
  });

  /**
   * Removes the status in the posts list.
   */
  api.reopenWidget("poster-name", {
    addUserStatus(contents, attrs) {
      if (
        attrs.user &&
        attrs.user.id === currentUser.id &&
        !userAllowed(this.currentUser)
      ) {
        return;
      }

      return this._super(contents, attrs);
    },
  });

  /**
   * Hides in chat messages.
   */
  api.modifyClass("component:chat-message-info", {
    pluginId: PLUGIN_ID,

    get showStatus() {
      const messageUser = this.args.message.user;

      // FIX ME: messageUser doesn't contain groups data. 

      if (currentUser.id === messageUser.id) {
        return userAllowed(messageUser);
      }

      return messageUser.get("status");
    },
  });

  /**
   * Hides the status emoji near the username in preferences page,
   * by wrapping the "user-status-message" template with <div class="hidden"></div>.
   */
  api.modifyClass("component:user-status-message", {
    pluginId: PLUGIN_ID,

    didReceiveAttrs() {
      this._super(...arguments);

      // Specific to preference page.
      if (
        !api.container
          .lookup("service:router")
          ?.currentRouteName.startsWith("preferences")
      ) {
        return;
      }

      // Prevents changes in chat if drawer is not in fullscreen
      // as template is used there and being covered in another way.
      if (
        !this.parentView ||
        this.parentView.attrs?.channel ||
        this.parentView.attrs?.class !== "user-main"
      ) {
        return;
      }

      if (!userAllowed(this.currentUser)) {
        this.tagName = "div";
        this.classNames = ["hidden", ...this.classNames];
      }
    },
  });
});
