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

  // If everyone group, don't go further.
  if (groupsIds.includes(0)) {
    return;
  }

  const userAllowed = (groups) =>
    groups
      .map((group) => Number(group.id))
      .some((id) => groupsIds.includes(id));

  api.modifyClass("controller:preferences/account", {
    pluginId: PLUGIN_ID,

    @discourseComputed()
    canSelectUserStatus() {
      return userAllowed(this.currentUser.groups);
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


});
