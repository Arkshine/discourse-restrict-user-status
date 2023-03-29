import { apiInitializer } from "discourse/lib/api";
import { scheduleOnce } from "@ember/runloop";
import { getOwner } from "@ember/application";
import discourseComputed from "discourse-common/utils/decorators";

const PLUGIN_ID = 'restrict-user-status';

export default apiInitializer("0.11.1", api => {
  const groupsIds = settings.allowed_groups.split("|").map(id => Number(id));

  // If everyone group, don't go further.
  if (groupsIds.includes(0)) {
    return;
  }  

  const userAllowed = (groups) => groups.map(group => Number(group.id)).some(id => groupsIds.includes(id))

  api.modifyClass('controller:preferences/account', {
    pluginId: PLUGIN_ID,

    @discourseComputed()
    canSelectUserStatus() {
      return userAllowed(this.currentUser.groups);
    }
  });

  api.modifyClass('component:user-card-contents', {
    pluginId: PLUGIN_ID,

    @discourseComputed("user.status")
    hasStatus() {
      return this.siteSettings.enable_user_status && this.user.status && userAllowed(this.currentUser.groups);
    }
  });

  api.modifyClass('component:user-menu/menu-tab', {
    pluginId: PLUGIN_ID,

    removeUserStatus() {

      document.querySelector('li.set-user-status')?.remove()
    },
    
    get isActive() {
      const isActive = this.args.tab.id === this.args.currentTabId;

      if (isActive && this.args.currentTabId === 'profile' && !userAllowed(getOwner(this).lookup('service:current-user')?.groups)) {
        scheduleOnce("afterRender", this, 'removeUserStatus');
      }
      
      return isActive;
    }
  });
});
