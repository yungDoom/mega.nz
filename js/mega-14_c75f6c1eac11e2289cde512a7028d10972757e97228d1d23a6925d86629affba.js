/* Bundle Includes:
 *   js/fm/account.js
 *   js/fm/account-change-password.js
 *   js/fm/account-change-email.js
 *   js/fm/dialogs.js
 *   js/ui/dropdowns.js
 *   js/ui/node-filter.js
 *   js/ui/info-panel.js
 *   js/notify.js
 *   js/vendor/avatar.js
 */

function accountUI() {

    "use strict";

    // Prevent ephemeral session to access account settings via url
    if (u_type === 0) {
        msgDialog('confirmation', l[998], l[17146]
            + ' ' + l[999], l[1000], function(e) {
            if (e) {
                loadSubPage('register');
                return false;
            }
            loadSubPage('fm');
        });

        return false;
    }

    var $fmContainer = $('.fm-main', '.fmholder');
    var $settingsMenu = $('.content-panel.account', $fmContainer);

    accountUI.$contentBlock = $('.fm-right-account-block', $fmContainer);

    $('.fm-account-notifications', accountUI.$contentBlock).removeClass('hidden');
    $('.settings-button', $settingsMenu).removeClass('active');
    $('.fm-account-sections', accountUI.$contentBlock).addClass('hidden');
    $('.fm-right-files-block, .section.conversations, .fm-right-block.dashboard',  $fmContainer)
        .addClass('hidden');
    $('.nw-fm-left-icon', $fmContainer).removeClass('active');
    $('.nw-fm-left-icon.settings', $fmContainer).addClass('active');
    $('.account.data-block.storage-data', accountUI.$contentBlock).removeClass('exceeded');
    $('.fm-account-save', accountUI.$contentBlock).removeClass('disabled');
    accountUI.$contentBlock.removeClass('hidden');

    if ($('.fmholder', 'body').hasClass('transfer-panel-opened')) {
        $.transferClose();
    }

    M.onSectionUIOpen('account');

    if (u_attr && u_attr.b && !u_attr.b.m) {
        $('.settings-button.slide-in-out.plan', $settingsMenu).addClass('hidden');
    }
    else {
        $('.settings-button.slide-in-out.plan', $settingsMenu).removeClass('hidden');
    }
    M.accountData((account) => {

        accountUI.renderAccountPage(account);

        // Init account content scrolling
        // Scrolling init/update became faster than promise based operations in "renderAccountPage"
        // instead or refactoring "accounts" page to return a promise in "rendering" a non noticeable
        // heuristic 300ms delay has been added. I believe this delay simulate the slowness which allowed
        // the previous logic to work.
        delay('settings:scrollbarinit', accountUI.initAccountScroll, 300);
    }, 1);
}

accountUI.initAccountScroll = function() {

    'use strict';

    const $scrollBlock = accountUI.$contentBlock || $('.fm-right-account-block');

    if (!$scrollBlock.length) {
        return false;
    }

    if ($scrollBlock.is('.ps')) {
        Ps.update($scrollBlock[0]);
    }
    else {
        Ps.initialize($scrollBlock[0]);
    }
};

accountUI.renderAccountPage = function(account) {

    'use strict';

    if (d) {
        console.log('Rendering account pages');
    }

    var id = getSitePath();
    if (u_attr && u_attr.b && !u_attr.b.m && id.startsWith('/fm/account/plan')) {
        id = '/fm/account';
    }

    // Parse subSectionId and remove sub section part from id
    const accountRootUrl = '/fm/account';
    let subSectionId;

    if (id.length > accountRootUrl.length) {
        let urlPart0;
        let urlPart1;
        const sectionUrl = id.substr(accountRootUrl.length + 1, id.length);
        const sectionUrlParts = sectionUrl.split('/');

        if (sectionUrlParts.length === 1) {
            urlPart0 = sectionUrlParts[0];
        }
        else {
            urlPart0 = sectionUrlParts[0];
            urlPart1 = sectionUrlParts[1];
        }

        const $accountSubSectionElement = $(`.settings-button.account-s .sub-title[data-scrollto='${urlPart0}']`);
        if ($accountSubSectionElement.length > 0) {
            id = accountRootUrl;
            subSectionId = urlPart0;
        }
        else {
            id = `${accountRootUrl}/${urlPart0}`;
            id = id.replace(/\W+$/, '');
            subSectionId = urlPart1;
        }
    }

    var sectionClass;
    accountUI.general.init(account);
    accountUI.inputs.text.init();

    var showOrHideBanner = function(sectionName) {

        var $banner = $('.quota-banner', accountUI.$contentBlock);

        if (sectionName === '/fm/account' || sectionName === '/fm/account/plan'
            || sectionName === '/fm/account/transfers') {
            $banner.removeClass('hidden');
        }
        else {
            $banner.addClass('hidden');
        }

        // If Pro Flexi or Business, hide the banner
        if (u_attr && (u_attr.pf || u_attr.b)) {
            $banner.addClass('hidden');
        }
    };

    showOrHideBanner(id);

    // Always hide the add-phone banner if it was shown by the account profile sub page
    accountUI.account.profiles.hidePhoneBanner();

    switch (id) {

        case '/fm/account':
            $('.fm-account-profile').removeClass('hidden');
            sectionClass = 'account-s';
            accountUI.account.init(account);
            break;

        case '/fm/account/plan':
            if ($.openAchievemetsDialog) {
                delete $.openAchievemetsDialog;
                onIdle(function() {
                    $('.fm-account-plan .btn-achievements:visible', accountUI.$contentBlock).trigger('click');
                });
            }
            $('.fm-account-plan', accountUI.$contentBlock).removeClass('hidden');
            sectionClass = 'plan';
            accountUI.plan.init(account);
            break;

        case '/fm/account/security':
            $('.fm-account-security', accountUI.$contentBlock).removeClass('hidden');
            sectionClass = 'security';
            accountUI.security.init();
            if ($.scrollIntoSection && $($.scrollIntoSection, accountUI.$contentBlock).length) {
                $($.scrollIntoSection, accountUI.$contentBlock)[0].scrollIntoView();
            }
            break;

        case '/fm/account/file-management':
            $('.fm-account-file-management', accountUI.$contentBlock).removeClass('hidden');
            sectionClass = 'file-management';

            accountUI.fileManagement.init(account);
            break;

        case '/fm/account/transfers':
            $('.fm-account-transfers', accountUI.$contentBlock).removeClass('hidden');
            sectionClass = 'transfers';

            accountUI.transfers.init(account);
            break;

        case '/fm/account/contact-chats':
            $('.fm-account-contact-chats', accountUI.$contentBlock).removeClass('hidden');
            sectionClass = 'contact-chats';

            accountUI.contactAndChat.init();
            break;

        case '/fm/account/reseller' /** && M.account.reseller **/:
            if (!account.reseller) {
                loadSubPage('fm/account');
                return false;
            }
            $('.fm-account-reseller', accountUI.$contentBlock).removeClass('hidden');
            sectionClass = 'reseller';

            accountUI.reseller.init(account);
            break;

        case '/fm/account/notifications':
            $('.fm-account-notifications').removeClass('hidden');
            $('.quota-banner', '.fm-account-main', accountUI.$contentBlock).addClass('hidden');
            sectionClass = 'notifications';

            accountUI.notifications.init(account);
            break;

        case '/fm/account/calls':
            $('.fm-account-calls').removeClass('hidden');
            sectionClass = 'calls';

            accountUI.calls.init();
            break;

        case '/fm/account/s4':
            if (!accountUI.s4 || !u_attr.s4) {
                loadSubPage('fm/account');
                return false;
            }
            $('.fm-account-s4').removeClass('hidden');
            sectionClass = 's4';
            accountUI.s4.init();
            break;
        default:

            // This is the main entry point for users who just had upgraded their accounts
            if (isNonActivatedAccount()) {
                alarm.nonActivatedAccount.render(true);
                break;
            }

            // If user trying to use wrong url within account page, redirect them to account page.
            loadSubPage('fm/account');
            break;
    }

    accountUI.leftPane.init(sectionClass);

    mBroadcaster.sendMessage('settingPageReady');
    fmLeftMenuUI();

    if (subSectionId) {
        $(`.settings-button.${sectionClass} .sub-title[data-scrollto='${subSectionId}']`).trigger('click');
    }

    loadingDialog.hide();
};

accountUI.general = {

    init: function(account) {

        'use strict';

        clickURLs();

        this.charts.init(account);
        this.userUIUpdate();
        this.bindEvents();
    },

    bindEvents: function() {

        'use strict';

        // Upgrade Account Button
        $('.upgrade-to-pro', accountUI.$contentBlock).rebind('click', function() {
            if (u_attr && u_attr.b && u_attr.b.m && (u_attr.b.s === -1 || u_attr.b.s === 2)) {
                loadSubPage('repay');
            }
            else {
                loadSubPage('pro');
            }
        });

        $('.download-sync', accountUI.$contentBlock).rebind('click', function() {

            var pf = navigator.platform.toUpperCase();

            // If this is Linux send them to desktop page to select linux type
            if (pf.indexOf('LINUX') > -1) {
                mega.redirect('mega.io', 'desktop', false, false, false);
            }
            // else directly give link of the file.
            else {
                window.location = megasync.getMegaSyncUrl();
            }
        });
    },

    /**
     * Helper function to fill common charts into the dashboard and account sections
     * @param {Object}  account       User account data (I.e. same as M.account)
     */
    charts: {

        perc_c_s : 0,
        perc_c_b : 0,

        init: function(account) {

            'use strict';

            /* Settings and Dasboard ccontent blocks */
            this.$contentBlock = $('.fm-right-block.dashboard, .fm-right-account-block', '.fm-main');

            this.bandwidthChart(account);
            this.usedStorageChart(account);
            this.chartWarningNoti(account);
        },

        bandwidthChart: function(account) {

            'use strict';

            /* New Used Bandwidth chart */
            this.perc_c_b = account.tfsq.perc > 100 ? 100 : account.tfsq.perc;

            var $bandwidthChart = $('.fm-account-blocks.bandwidth', this.$contentBlock);
            var fullDeg = 360;
            var deg = fullDeg * this.perc_c_b / 100;

            // Used Bandwidth chart
            if (this.perc_c_b < 50) {
                $('.left-chart span', $bandwidthChart).css('transform', 'rotate(180deg)');
                $('.right-chart span', $bandwidthChart).css('transform', `rotate(${180 - deg}deg)`);
                $('.right-chart', $bandwidthChart).addClass('low-percent-clip');
                $('.left-chart', $bandwidthChart).addClass('low-percent-clip');
            }
            else {
                $('.left-chart span', $bandwidthChart).css('transform', 'rotate(180deg)');
                $('.right-chart span', $bandwidthChart).css('transform', `rotate(${(deg - 180) * -1}deg)`);
                $('.right-chart', $bandwidthChart).removeClass('low-percent-clip');
                $('.left-chart', $bandwidthChart).removeClass('low-percent-clip');
            }

            if (this.perc_c_b > 99 || dlmanager.isOverQuota) {
                $bandwidthChart.addClass('exceeded');
            }
            else if (this.perc_c_b > 80) {
                $bandwidthChart.addClass('going-out');
            }

            // Maximum bandwidth
            var b2 = bytesToSize(account.tfsq.max, 0).split('\u00A0');
            var usedB = bytesToSize(account.tfsq.used);
            $('.chart.data .size-txt', $bandwidthChart).text(usedB);
            $('.chart.data .pecents-txt', $bandwidthChart).text(bytesToSize(account.tfsq.max, 3, 4));
            $('.chart.data .of-txt', $bandwidthChart).text('/');
            $('.account.chart.data', $bandwidthChart).removeClass('hidden');
            if ((u_attr.p || account.tfsq.ach) && b2[0] > 0) {
                if (this.perc_c_b > 0) {
                    $bandwidthChart.removeClass('no-percs');
                    $('.chart .perc-txt', $bandwidthChart).text(formatPercentage(this.perc_c_b / 100));
                }
                else {
                    $bandwidthChart.addClass('no-percs');
                    $('.chart .perc-txt', $bandwidthChart).text('---');
                }
            }
            else {
                $bandwidthChart.addClass('no-percs');
                $('.chart .perc-txt', $bandwidthChart).text('---');
                $('.chart.data > span:not(.size-txt)', $bandwidthChart).text('');
                var usedW;
                if (usedB[0] === '1') {
                    usedW = l[17524].toLowerCase().replace('%tq1', '').trim();
                }
                else if (usedB[0] === '2') {
                    usedW = l[17525].toLowerCase().replace('%tq2', '').trim();
                }
                else {
                    usedW = l[17517].toLowerCase().replace('%tq', '').trim();
                }
                $('.chart.data .pecents-txt', $bandwidthChart).text(usedW);
            }

            if (!account.maf) {
                this.$contentBlock.removeClass('active-achievements');
            }
            else {
                this.$contentBlock.addClass('active-achievements');
            }

            /* End of New Used Bandwidth chart */
        },

        usedStorageChart: function(account) {

            'use strict';

            /* New Used Storage chart */
            var $storageChart = $('.fm-account-blocks.storage', this.$contentBlock);
            var usedPercentage = Math.floor(account.space_used / account.space * 100);
            this.perc_c_s = usedPercentage;
            if (this.perc_c_s > 100) {
                this.perc_c_s = 100;
            }
            $storageChart.removeClass('exceeded going-out');

            if (this.perc_c_s === 100) {
                $storageChart.addClass('exceeded');
            }
            else if (this.perc_c_s >= account.uslw / 100) {
                $storageChart.addClass('going-out');
            }

            var fullDeg = 360;
            var deg = fullDeg * this.perc_c_s / 100;

            // Used space chart
            if (this.perc_c_s < 50) {
                $('.left-chart span', $storageChart).css('transform', 'rotate(180deg)');
                $('.right-chart span', $storageChart).css('transform', `rotate(${180 - deg}deg)`);
                $('.right-chart', $storageChart).addClass('low-percent-clip');
                $('.left-chart', $storageChart).addClass('low-percent-clip');
            }
            else {
                $('.left-chart span', $storageChart).css('transform', 'rotate(180deg)');
                $('.right-chart span', $storageChart).css('transform', `rotate(${(deg - 180) * -1}deg)`);
                $('.right-chart', $storageChart).removeClass('low-percent-clip');
                $('.left-chart', $storageChart).removeClass('low-percent-clip');
            }

            // Maximum disk space
            $('.chart.data .pecents-txt', $storageChart).text(bytesToSize(account.space, 0));
            $('.chart .perc-txt', $storageChart).text(formatPercentage(usedPercentage / 100));
            $('.chart.data .size-txt', $storageChart).text(bytesToSize(account.space_used));
            $('.account.chart.data', $storageChart).removeClass('hidden');
            /** End New Used Storage chart */
        },

        // TODO: this need to be modified to using on dashboard
        chartWarningNoti: function(account) {

            'use strict';

            var b_exceeded = this.perc_c_t > 99 || dlmanager.isOverQuota;
            var s_exceeded = this.perc_c_s === 100;

            // Charts warning notifications
            var $chartsBlock = $('.account.quota-banner', this.$contentBlock);

            $('.chart-warning:not(.hidden)', $chartsBlock).addClass('hidden');

            if (b_exceeded && s_exceeded) {
                // Bandwidth and Storage quota exceeded
                $('.chart-warning.storage-and-bandwidth', $chartsBlock).removeClass('hidden');
            }
            else if (s_exceeded) {
                // Storage quota exceeded
                $('.chart-warning.storage', $chartsBlock).removeClass('hidden');
            }
            else if (b_exceeded) {
                // Bandwidth quota exceeded
                $('.chart-warning.bandwidth', $chartsBlock).removeClass('hidden');
            }
            else if (this.perc_c_s >= account.uslw / 100) {
                // Running out of cloud space
                $('.chart-warning.out-of-space', $chartsBlock).removeClass('hidden');
            }
            if (b_exceeded || s_exceeded || this.perc_c_s >= account.uslw / 100) {
                $('.chart-warning', $chartsBlock).rebind('click', function() {
                    loadSubPage('pro');
                });
            }
            /* End of Charts warning notifications */
        }
    },

    /**
     * Update user UI (pro plan, avatar, first/last name, email)
     */
    userUIUpdate: function() {
        'use strict';

        var $fmContent = $('.fm-main', '.fmholder');
        var $dashboardPane = $('.content-panel.dashboard', $fmContent);

        // Show Membership plan
        $('.account .plan-icon', $dashboardPane).removeClass('pro1 pro2 pro3 pro4 pro100 pro101 free');

        // Default is Free (proNum undefined)
        let proNum = u_attr.p;
        let planClass = 'free';
        let planText = l[1150];

        // If Business or Pro Flexi, always show the icon & name (even if expired, which is when u_attr.p is undefined)
        if (u_attr.b || u_attr.pf) {
            proNum = u_attr.b ? pro.ACCOUNT_LEVEL_BUSINESS : pro.ACCOUNT_LEVEL_PRO_FLEXI;
            planClass = 'pro' + proNum;
            planText = pro.getProPlanName(proNum);
        }

        // Otherwise if it's an active Pro account
        else if (proNum) {
            planClass = 'pro' + proNum;
            planText = pro.getProPlanName(proNum);
        }

        $('.account .plan-icon', $dashboardPane).addClass(planClass);
        $('.account.membership-plan', $dashboardPane).text(planText);

        // update avatar
        $('.fm-account-avatar', $fmContent).safeHTML(useravatar.contact(u_handle, '', 'div', false));
        $('.fm-avatar', $fmContent).safeHTML(useravatar.contact(u_handle));
        $('.top-menu-popup .avatar-block .wrapper', $fmContent).safeHTML(useravatar.contact(u_handle));

        // Show first name or last name
        $('.membership-big-txt.name', $dashboardPane).text(u_attr.fullname);

        // Show email address
        if (u_attr.email) {
            $('.membership-big-txt.email', $dashboardPane).text(u_attr.email);
        }
        else {
            $('.membership-big-txt.email', $dashboardPane).addClass('hidden');
        }
    },
};

accountUI.controls = {

    disableElement: function(element) {

        'use strict';

        $(element).addClass('disabled').prop('disabled', true);
    },

    enableElement: function(element) {

        'use strict';

        $(element).removeClass('disabled').prop('disabled', false);
    },
};

accountUI.inputs = {

    text: {

        init: function() {

            'use strict';

            var $inputs = $('.underlinedText', '.fm-account-main, .fm-voucher-popup');
            var megaInputs = new mega.ui.MegaInputs($inputs);
        }
    },

    radio: {

        init: function(identifier, $container, currentValue, onChangeCb) {

            'use strict';

            var self = this;
            var $radio = $(identifier, $container);
            var $labels = $('.radio-txt', $container);

            if (String(currentValue)) {
                this.set(identifier, $container, currentValue);
            }

            $('input', $radio).rebind('click.radio', function() {

                var newVal = $(this).val();
                self.set(identifier, $container, newVal, onChangeCb);
            });

            $labels.rebind('click.radioLabel', function() {
                $(this).prev(identifier).find('input', $radio).trigger('click');
            });
        },

        set: function(identifier, $container, newVal, onChangeCb) {

            'use strict';

            var $input = $('input' + identifier + '[value="' + newVal + '"]', $container);

            if ($input.is('.disabled')) {
                return;
            }

            $(identifier + '.radioOn', $container).addClass('radioOff').removeClass('radioOn');
            $input.removeClass('radioOff').addClass('radioOn').prop('checked', true);
            $input.parent().addClass('radioOn').removeClass('radioOff');

            if (typeof onChangeCb === 'function') {
                onChangeCb(newVal);
            }
        },

        disable: function(value, $container) {

            'use strict';

            $('input.[value="' + value + '"]', $container).addClass('disabled').prop('disabled', true);
        },

        enable: function(value, $container) {

            'use strict';

            $('input.[value="' + value + '"]', $container).removeClass('disabled').prop('disabled', false);
        },
    },

    radioCard: {
        init(identifier, $container, currentValue, onChangeCb) {
            'use strict';

            var $radio = $(identifier, $container);
            var $labels = $('.chat', $container);

            if (String(currentValue)) {
                this.set(identifier, $container, currentValue);
            }

            $('input', $radio).rebind('click.radio', (e, val) => {
                this.set(identifier, $container, val, onChangeCb);
            });

            $labels.rebind('click.radioLabel', function() {
                var newVal = $(this).prev(identifier).children('input', $radio).val();
                $(this).prev(identifier).children('input', $radio).trigger('click', newVal);
            });
        },

        set: function(identifier, $container, newVal, onChangeCb) {
            'use strict';

            var $input = $('input' + identifier + '[value="' + newVal + '"]', $container);

            $(identifier + '.radioOn', $container).addClass('radioOff').removeClass('radioOn');
            $(identifier + '.radioOff', $container).next().addClass('radioOff').removeClass('radioOn');
            $(identifier + '.radioOff', $container).next().children('.chat-selected').removeClass('checked');
            $input.removeClass('radioOff').addClass('radioOn').prop('checked', true);
            $input.parent().addClass('radioOn').removeClass('radioOff');
            $input.parent().next().addClass('radioOn').removeClass('radioOff');
            $input.parent().next().children('.chat-selected').addClass('checked');

            if (typeof onChangeCb === 'function') {
                onChangeCb(newVal);
            }
        }
    },

    switch: {

        init: function(identifier, $container, currentValue, onChangeCb, onClickCb) {

            'use strict';

            var self = this;
            var $switch = $(identifier, $container);

            if ($switch.attr('id') === 'file-request'){
                currentValue = !currentValue;
            }

            if ((currentValue && !$switch.hasClass('toggle-on'))
                || (!currentValue && $switch.hasClass('toggle-on'))) {
                this.toggle(identifier, $container);
            }

            Soon(function() {
                $('.no-trans-init', $switch).removeClass('no-trans-init');
            });

            $switch.rebind('click.switch', function() {

                const val = $switch.hasClass('toggle-on');

                if (typeof onClickCb === 'function') {
                    onClickCb(val).done(function() {
                        self.toggle(identifier, $container, onChangeCb);
                    });
                }
                else {
                    self.toggle(identifier, $container, onChangeCb);
                }
            });
        },

        toggle: function(identifier, $container, onChangeCb) {

            'use strict';

            var $switch = $(identifier, $container);
            let newVal;

            if ($switch.hasClass('toggle-on')) {
                $switch.removeClass('toggle-on');
                newVal = 0;
            }
            else {
                $switch.addClass('toggle-on');
                newVal = 1;
            }

            newVal = $switch.attr('id') === 'file-request' ? 1 - newVal : newVal;
            $switch.trigger('update.accessibility');

            if (typeof onChangeCb === 'function') {
                onChangeCb(newVal);
            }
        }
    }
};

accountUI.leftPane = {

    init: function(sectionClass) {

        'use strict';

        this.render(sectionClass);
        this.bindEvents();
    },

    render: function(sectionClass) {

        'use strict';

        var $settingsPane = $('.content-panel.account', '.fm-main');
        var $menuItems = $('.settings-button', $settingsPane);
        var $currentMenuItem = $menuItems.filter('.' + sectionClass);

        if (M.account.reseller) {
            // Show reseller button on naviation
            $menuItems.filter('.reseller').removeClass('hidden');
        }

        // Show S4 settings
        if (u_attr.s4) {
            // Show reseller button on naviation
            $menuItems.filter('.s4').removeClass('hidden');
        }

        if (accountUI.plan.paymentCard.validateUser(M.account)) {
            $('.acc-setting-menu-card-info', $menuItems).removeClass('hidden');
        }
        else {
            $('.acc-setting-menu-card-info', $menuItems).addClass('hidden');
        }

        $menuItems.filter(':not(.' + sectionClass + ')').addClass('closed').removeClass('active');
        $currentMenuItem.addClass('active');

        setTimeout(function() {
            $currentMenuItem.removeClass('closed');
            initTreeScroll();
        }, 600);
    },

    getPageUrlBySection: function($section) {

        'use strict';

        switch (true) {
            case $section.hasClass('account-s'):
                return 'fm/account';
            case $section.hasClass('plan'):
                return 'fm/account/plan';
            case $section.hasClass('notifications'):
                return 'fm/account/notifications';
            case $section.hasClass('security'):
                return 'fm/account/security';
            case $section.hasClass('file-management'):
                return 'fm/account/file-management';
            case $section.hasClass('transfers'):
                return 'fm/account/transfers';
            case $section.hasClass('contact-chats'):
                return 'fm/account/contact-chats';
            case $section.hasClass('reseller'):
                return 'fm/account/reseller';
            case $section.hasClass('calls'):
                return 'fm/account/calls';
            case $section.hasClass('s4'):
                return 'fm/account/s4';
            default:
                return 'fm/account';
        }
    },

    bindEvents: function() {

        'use strict';

        var $settingsPane = $('.content-panel.account', '.fm-main');

        $('.settings-button', $settingsPane).rebind('click', function() {

            const $this = $(this);
            if (!$this.hasClass('active')) {
                accountUI.$contentBlock.scrollTop(0);
                loadSubPage(accountUI.leftPane.getPageUrlBySection($this));
            }
        });

        $('.settings-button i.expand', $settingsPane).rebind('click', function(e) {

            var $button = $(this).closest('.settings-button');

            e.stopPropagation();
            $button.toggleClass('closed');
        });

        $('.settings-button .sub-title', $settingsPane).rebind('click', function() {

            const $this = $(this);
            const $parentBtn = $this.closest('.settings-button');
            const dataScrollto = $this.attr('data-scrollto');
            const $target = $(`.data-block.${dataScrollto}`);
            const parentPage = accountUI.leftPane.getPageUrlBySection($parentBtn);
            const page = `${parentPage}/${dataScrollto}`;
            const isHidden = $target.hasClass('hidden');

            if (isHidden) {
                // display: block removes an element from DOM, so we need to mimic it's location for a bit
                $target.addClass('v-hidden').removeClass('hidden');
            }

            const targetPosition = $target.position().top;

            if (isHidden) {
                $target.addClass('hidden').removeClass('v-hidden');
            }

            if ($parentBtn.hasClass('active')) {
                accountUI.$contentBlock.animate({ scrollTop: targetPosition }, 500);
                pushHistoryState(page);
            }
            else {
                $parentBtn.trigger('click');
                mBroadcaster.once('settingPageReady', function () {
                    pushHistoryState(page);
                    accountUI.$contentBlock.animate({scrollTop: $target.position().top}, 500);
                });
            }
        });
    }
};

accountUI.account = {

    init: function(account) {

        'use strict';

        var $settingsPane = $('.content-panel.account', '.fm-main');
        var $profileContent = $('.settings-sub-section.profile', accountUI.$contentBlock);

        // Profile
        this.profiles.resetProfileForm();
        this.profiles.renderPhoneBanner().catch(dump);
        this.profiles.renderFirstName();
        this.profiles.renderLastName();
        this.profiles.renderBirth();
        this.profiles.renderPhoneDetails();

        // if this is a business user, we want to hide some parts in profile page :)
        var hideOrViewCancelSection = function(setToHidden) {

            if (setToHidden) {
                $('.cancel-account-block', accountUI.$contentBlock).addClass('hidden');
                $('.acc-setting-menu-cancel-acc', $settingsPane).addClass('hidden');
                $('#account-firstname', $profileContent).prop('disabled', true);
                $('#account-lastname', $profileContent).prop('disabled', true);
            }
            else {
                $('.cancel-account-block', accountUI.$contentBlock).removeClass('hidden');
                $('.acc-setting-menu-cancel-acc', $settingsPane).removeClass('hidden');
                $('#account-firstname', $profileContent).prop('disabled', false);
                $('#account-lastname', $profileContent).prop('disabled', false);
            }
        };

        if (u_attr && u_attr.b) {
            $('.acc-setting-country-sec', $profileContent).addClass('hidden');
            if (!u_attr.b.m) {
                hideOrViewCancelSection(true);
            }
            else {
                $('.cancel-account-block .content-txt.bus-acc', accountUI.$contentBlock).removeClass('hidden');
                hideOrViewCancelSection(false);
            }
        }
        else {

            // user can set country only in non-business accounts
            $('.acc-setting-country-sec', $profileContent).removeClass('hidden');

            this.profiles.renderCountry();

            // we allow cancel for only non-business account + master users.
            hideOrViewCancelSection(false);
        }

        this.profiles.bindEvents();

        // QR Code
        this.qrcode.render(account);
        this.qrcode.bindEvents();

        // Preference
        this.preference.render();

        // Cancel Account
        this.cancelAccount.bindEvents();
    },

    profiles: {

        hidePhoneBanner: async function() {
            'use strict';

            $('.add-phone-num-banner', accountUI.$contentBlock).addClass('hidden');
        },
        /**
         * Render a banner at the top of the My Account section for enticing a user to add their phone number
         * so that they can get an achievement bonus and link up with their phone contacts that might be on MEGA
         */
        renderPhoneBanner: async function() {

            'use strict';

            // Cache selectors
            var $addPhoneBanner = $('.add-phone-num-banner', accountUI.$contentBlock);
            var $usageBanner = $('.quota-banner', accountUI.$contentBlock);
            var $text = $('.add-phone-text', $addPhoneBanner);
            var $addPhoneButton = $('.js-add-phone-button', $addPhoneBanner);
            var $skipButton = $('.skip-button', $addPhoneBanner);
            var $notAgainCheckbox = $('.notagain', $addPhoneBanner);

            // M.maf is cached in its getter, however, repeated gets will cause unnecessary checks.
            var ach = M.maf;

            const hideOrDisplayBanner = () => {
                // If not Business/Pro Flexi, show the standard storage/bandwidth usage banner instead of phone banner
                if (typeof u_attr.b === 'undefined' && typeof u_attr.pf === 'undefined') {
                    $usageBanner.removeClass('hidden');
                    $addPhoneBanner.addClass('hidden');
                }
                else {
                    // Otherwise for Business or Pro Flexi accounts hide both banners
                    $usageBanner.addClass('hidden');
                    $addPhoneBanner.addClass('hidden');
                }
            };

            // If SMS verification enable is not on level 2 (Opt-in and unblock SMS allowed) then do nothing. Or if
            // they already have already added a phone number then don't show this banner again. Or if they clicked the
            // skip button then don't show the banner.
            if (u_attr.flags.smsve !== 2 || typeof u_attr.smsv !== 'undefined' || fmconfig.skipsmsbanner
                || ach && ach[9] && ach[9].rwd) {
                hideOrDisplayBanner();
                return false;
            }

            const phoneBannerTimeChecker = await mega.TimeChecker.PhoneBanner.init(
                () => {
                    return !$addPhoneBanner.hasClass('hidden');
                }
            );

            if (!phoneBannerTimeChecker ||
                phoneBannerTimeChecker
                    && !phoneBannerTimeChecker.shouldShow()
                    && !phoneBannerTimeChecker.hasUpdated()
            ) {
                hideOrDisplayBanner();
                return false;
            }

            // On click of the Add Number button load the add phone dialog
            $addPhoneButton.rebind('click.phonebanner', () => {
                sms.phoneInput.init();
            });

            $notAgainCheckbox.rebind('click.phonebanner', () => {
                const $input = $('.checkinput', $notAgainCheckbox);
                const $checkboxDiv = $('.checkdiv', $notAgainCheckbox);

                // If unticked, tick the box
                if ($input.hasClass('checkboxOff')) {
                    $input.removeClass('checkboxOff').addClass('checkboxOn').prop('checked', true);
                    $checkboxDiv.removeClass('checkboxOff').addClass('checkboxOn');
                }
                else {
                    // Otherwise untick the box
                    $input.removeClass('checkboxOn').addClass('checkboxOff').prop('checked', false);
                    $checkboxDiv.removeClass('checkboxOn').addClass('checkboxOff');
                }
                return false;
            });

            sms.renderAddPhoneText($text);
            // Show the phone banner, hide the storage/bandwidth usage banner
            $usageBanner.addClass('hidden');
            $addPhoneBanner.removeClass('hidden');

            if (phoneBannerTimeChecker) {
                if (!phoneBannerTimeChecker.hasUpdated()) {
                    phoneBannerTimeChecker.update();
                }

                if (phoneBannerTimeChecker.isMoreThan10Times()) {
                    $notAgainCheckbox.removeClass('hidden');
                }

                $skipButton.removeClass('hidden'); // Show the skip button
                // On click of the Skip button, hide the banner and don't show it again
                $skipButton.rebind('click.phonebanner', () => {
                    phoneBannerTimeChecker.update();
                    // Hide the banner
                    $addPhoneBanner.addClass('hidden');

                    // Save in fmconfig so it is not shown again on reload or login on different machine
                    const notAgain = $('.checkinput', $notAgainCheckbox).prop('checked');
                    if (notAgain) {
                        mega.config.set('skipsmsbanner', 1);
                    }
                });
            }

            // If a Business / Pro Flexi account, permanently hide the usage and phone banners
            if (typeof u_attr.b !== 'undefined' || typeof u_attr.pf !== 'undefined') {
                $usageBanner.addClass('hidden');
                $addPhoneBanner.addClass('hidden');
            }
        },

        renderFirstName: function() {

            'use strict';

            $('#account-firstname', accountUI.$contentBlock).val(u_attr.firstname).trigger('blur');
        },

        renderLastName: function() {

            'use strict';

            $('#account-lastname', accountUI.$contentBlock).val(u_attr.lastname).trigger('blur');
        },

        renderBirth: function () {

            'use strict';

            // If $.dateTimeFormat['stucture'] is not set, prepare it for birthday
            if (!$.dateTimeFormat.structure) {
                $.dateTimeFormat.structure = getDateStructure() || 'ymd';
            }

            // Display only date format that is correct with current locale.
            $('.mega-input.birth', accountUI.$contentBlock).addClass('hidden');
            $('.mega-input.birth.' + $.dateTimeFormat.structure, accountUI.$contentBlock)
                .removeClass('hidden');

            this.renderBirthYear();
            this.renderBirthMonth();
            this.renderBirthDay();
        },

        renderBirthYear: function() {

            'use strict';

            var i = new Date().getFullYear() - 16;
            var formatClass = '.' + $.dateTimeFormat.structure + ' .byear';
            var $input = $('.mega-input.birth' + formatClass, accountUI.$contentBlock)
                .attr('max', i);

            if (u_attr.birthyear) {
                $input.val(u_attr.birthyear).trigger('input');
            }
        },

        renderBirthMonth: function() {

            'use strict';

            if (u_attr.birthmonth) {
                var formatClass = '.' + $.dateTimeFormat.structure + ' .bmonth';
                var $input = $('.mega-input.title-ontop.birth' + formatClass, accountUI.$contentBlock);
                $input.val(u_attr.birthmonth).trigger('input');
                if ($input.length) {
                    this.zerofill($input[0]);
                }
            }
        },

        renderBirthDay: function() {

            'use strict';

            if (u_attr.birthday) {
                var formatClass = '.' + $.dateTimeFormat.structure + ' .bdate';
                var $input = $('.mega-input.title-ontop.birth' + formatClass, accountUI.$contentBlock);
                $input.val(u_attr.birthday).trigger('input');
                if ($input.length) {
                    this.zerofill($input[0]);
                }
            }
        },

        renderCountry: function() {
            'use strict';

            const $country = $('#account-country', accountUI.$contentBlock);

            createDropdown($country, {
                placeholder: $('span', $country).text(l[996]),
                items: M.getCountries(),
                selected: u_attr.country
            });

            // Bind Dropdowns events
            bindDropdownEvents($country, 1);
        },

        /**
         * Show the phone number section if applicable
         */
        renderPhoneDetails: function() {

            'use strict';

            // If SMS Verification Enable is on level 1 (SMS suspended unlock allowed only) and they've verified
            // by phone already, show the section and number. Or if SMS Verification Enable is on level 2 (Opt-in SMS
            // allowed), then show the section (and number if added, or an Add button).
            if ((u_attr.flags.smsve === 1 && typeof u_attr.smsv !== 'undefined') || u_attr.flags.smsve === 2) {

                // Cache selectors
                var $content = $('.fm-account-main', accountUI.$contentBlock);
                var $phoneSettings = $('.phone-number-settings', $content);
                var $text = $('.add-phone-text', $phoneSettings);
                var $phoneNumber = $('.phone-number', $phoneSettings);
                var $addNumberButton = $('.add-number-button', $phoneSettings);
                var $buttonsContainer = $('.gsm-mod-rem-btns', $content);
                var $removeNumberButton = $('.rem-gsm', $buttonsContainer);
                var $modifyNumberButton = $('.modify-gsm', $buttonsContainer);

                // If the phone is already added, show that
                if (typeof u_attr.smsv !== 'undefined') {
                    $addNumberButton.addClass('hidden');
                    $text.addClass('hidden');
                    $buttonsContainer.removeClass('hidden');
                    $phoneNumber.removeClass('hidden').text(u_attr.smsv);

                    $removeNumberButton.rebind('click.gsmremove', () => {
                        msgDialog('confirmation', '', l[23425], l[23426], answer => {
                            if (answer) {
                                accountUI.account.profiles.removePhoneNumber()
                                    .then(() => {
                                        msgDialog('info', '', l[23427]);
                                    })
                                    .catch(dump);
                            }
                        });
                    });
                    $modifyNumberButton.rebind('click.gsmmodify', () => {
                        msgDialog('confirmation', '', l[23429], l[23430], answer => {
                            if (answer) {
                                sms.phoneInput.init();
                            }
                        });
                    });
                }
                else {
                    $addNumberButton.removeClass('hidden');
                    $text.removeClass('hidden');
                    $buttonsContainer.addClass('hidden');
                    $phoneNumber.addClass('hidden').text('');

                    // On click of the Add Number button load the add phone dialog
                    $addNumberButton.rebind('click', function() {

                        sms.phoneInput.init();
                    });
                }

                // Show the section
                $phoneSettings.removeClass('hidden');
            }
        },

        zerofill: function(elem) {

            'use strict';

            if (elem.value.length === 1) {
                elem.value = '0' + elem.value;
            }
        },

        /**
         * Send remove command to API, and update UI if needed
         * @param {Boolean} showSuccessMsg      Show message dialog on success
         */
        async removePhoneNumber() {
            'use strict';
            const res = await api.req({a: 'smsr'}).catch(echo);

            if (res && res.result === 0) {
                // success
                // no APs, we need to rely on this response.
                delete u_attr.smsv;

                // update only relevant sections in UI
                accountUI.account.profiles.renderPhoneBanner();
                accountUI.account.profiles.renderPhoneDetails();
            }
            else {
                msgDialog('warningb', '', l[23428], `${res < 0 ? api_strerror(res) : res}`);

                throw new MEGAException(l[23428], res);
            }
        },

        resetProfileForm: function() {

            'use strict';

            var $personalInfoBlock = $('.profile-form', accountUI.$contentBlock);
            var $saveBlock = $('.fm-account-sections .save-block', accountUI.$contentBlock);

            $('input', $personalInfoBlock).val('');
            $('.error, .errored', $personalInfoBlock).removeClass('error errored');
            $saveBlock.addClass('closed');
        },

        bindEvents: function() {

            'use strict';

            // Cache selectors
            var self = this;
            var $personalInfoBlock = $('.profile-form', accountUI.$contentBlock);
            var $birthdayBlock = $('.mega-input.title-ontop.birth.' + $.dateTimeFormat.structure,
                $personalInfoBlock);
            var $firstNameField = $('#account-firstname', $personalInfoBlock);
            var $lastNameField = $('#account-lastname', $personalInfoBlock);
            var $countryDropdown = $('#account-country', $personalInfoBlock);
            var $saveBlock = $('.fm-account-sections .save-block', accountUI.$contentBlock);
            var $saveButton = $('.fm-account-save', $saveBlock);

            // Avatar
            $('.avatar-wrapper, .settings-sub-section.avatar .avatar', $personalInfoBlock)
                .rebind('click.showDialog', function() {
                    avatarDialog();
                });

            // All profile text inputs
            $firstNameField.add($lastNameField).add('.byear, .bmonth, .bdate', $birthdayBlock)
                .rebind('input.settingsGeneral change.settingsGeneral', function() {

                    var $this = $(this);
                    var $parent = $this.parent();
                    var errorMsg = l[20960];
                    var max = parseInt($this.attr('max'));
                    var min = parseInt($this.attr('min'));

                    if ($this.is('.byear, .bmonth, .bdate')) {
                        if (this.value > max || this.value < min) {

                            if ($this.is('.byear') && this.value > max && this.value === u_attr.birthyear) {
                                // To omit the case that users already set invalid year value
                                // before implied the restrictions
                                return true;
                            }

                            $this.addClass('errored');
                            $parent.addClass('error msg');
                            var $msg = $('.message-container', $parent).text(errorMsg);
                            $parent.css('margin-bottom', $msg.outerHeight() + 20 + 'px');
                            $saveBlock.addClass('closed');

                            return false;
                        }
                        else {
                            $this.removeClass('errored');
                            var $erroredInput = $parent.find('.errored');
                            if ($erroredInput.length){
                                $($erroredInput[0]).trigger('change');
                            }
                            else {
                                $parent.removeClass('error msg');
                                $parent.css('margin-bottom', '');
                            }
                        }
                    }

                    var enteredFirst = $firstNameField.val().trim();
                    var enteredLast = $lastNameField.val().trim();

                    if (enteredFirst.length > 0 && enteredLast.length > 0 &&
                        !$('.errored', $personalInfoBlock).length &&
                        (enteredFirst !== u_attr.firstname ||
                        enteredLast !== u_attr.lastname ||
                        ($('.bdate', $birthdayBlock).val() | 0) !== (u_attr.birthday | 0) ||
                        ($('.bmonth', $birthdayBlock).val() | 0) !== (u_attr.birthmonth | 0) ||
                        ($('.byear', $birthdayBlock).val() | 0)  !== (u_attr.birthyear | 0))) {
                        $saveBlock.removeClass('closed');
                    }
                    else {
                        $saveBlock.addClass('closed');
                    }
                });

            $('.byear, .bmonth, .bdate', $birthdayBlock).rebind('keydown.settingsGeneral', function(e) {

                var $this = $(this);
                var charCode = e.which || e.keyCode; // ff
                var $parent = $this.parent();
                var max = parseInt($this.attr('max'));
                var min = parseInt($this.attr('min'));

                if (!e.shiftkey &&
                    !((charCode >= 48 && charCode <= 57) || (charCode >= 96 && charCode <= 105)) &&
                    (charCode !== 8 && charCode !== 9 && charCode !== 37 && charCode !== 39)){
                    e.preventDefault();
                }

                if (charCode === 38) {
                    if (!this.value || parseInt(this.value) < parseInt(min)) {
                        this.value = min;
                    }
                    else if (parseInt(this.value) >= parseInt(max)) {
                        this.value = max;
                    }
                    else {
                        this.value++;
                    }
                    $parent.removeClass('error');
                    $this.removeClass('errored').trigger('change');
                    self.zerofill(this);
                }

                if (charCode === 40) {
                    if (parseInt(this.value) <= parseInt(min)) {
                        this.value = min;
                    }
                    else if (!this.value || parseInt(this.value) > parseInt(max)) {
                        this.value = max;
                    }
                    else {
                        this.value--;
                    }
                    $parent.removeClass('error');
                    $this.removeClass('errored').trigger('change');
                    self.zerofill(this);
                }
            });

            $('.bmonth, .bdate', $birthdayBlock).rebind('blur.settingsGeneral', function() {
                self.zerofill(this);
            });

            $('.birth-arrow', $personalInfoBlock).rebind('click', function() {

                var $this = $(this);
                var $target = $this.parent('.birth-arrow-container').prev('input');
                var e = $.Event('keydown.settingsGeneral');
                e.which = $this.hasClass('up-control') ? 38 : 40;
                $target.trigger(e);
            });

            $('.mega-input-dropdown .option', $countryDropdown).rebind('click.showSave', function() {

                if ($firstNameField.val() && $firstNameField.val().trim().length > 0
                    && !$personalInfoBlock.find('.errored').length) {
                    $saveBlock.removeClass('closed');
                }
                else {
                    $saveBlock.addClass('closed');
                }
            });

            $saveButton.rebind('click', function() {

                if ($(this).hasClass('disabled')) {
                    return false;
                }

                const $bd = $('.bdate', $birthdayBlock);
                const $bm = $('.bmonth', $birthdayBlock);
                const $by = $('.byear', $birthdayBlock);

                const bd = $bd.val();
                const bm = $bm.val();
                const by = $by.val();

                // Check whether the birthday info gets changed
                const bd_old = u_attr.birthday || '';
                const bm_old = u_attr.birthmonth || '';
                const by_old = u_attr.birthyear || '';
                const birthdayChanged = bd_old !== bd || bm_old !== bm || by_old !== by;

                if (birthdayChanged && M.validateDate(parseInt(bd), parseInt(bm), parseInt(by)) !== 0) {

                    const $parent = $bd.parent().addClass('error msg');
                    var $msg = $('.message-container', $parent).text(l[20960]);
                    $parent.css('margin-bottom', `${$msg.outerHeight() + 20}px`);
                    $saveBlock.addClass('closed');

                    return false;
                }

                if ($('.bdate', $birthdayBlock).val())

                $('.fm-account-avatar').safeHTML(useravatar.contact(u_handle, '', 'div', false));
                $('.fm-avatar').safeHTML(useravatar.contact(u_handle));

                var checklist = {
                    firstname: String($('#account-firstname', $personalInfoBlock).val() || '').trim(),
                    lastname: String($('#account-lastname', $personalInfoBlock).val() || '').trim(),
                    birthday: String(bd || ''),
                    birthmonth: String(bm || ''),
                    birthyear: String(by || ''),
                    country: String(
                        getDropdownValue($('#account-country', $personalInfoBlock))
                    )
                };
                var userAttrRequest = { a: 'up' };

                var checkUpdated = function() {
                    var result = false;
                    for (var i in checklist) {
                        if (u_attr[i] === null || u_attr[i] !== checklist[i]) {
                            // we want also to catch the 'undefined' or null
                            // and replace with the empty string (or given string)
                            u_attr[i] = i === 'firstname' ? checklist[i] || 'Nobody' : checklist[i];
                            userAttrRequest[i] = base64urlencode(to8(u_attr[i]));
                            result = true;
                        }
                    }
                    return result;
                };

                if (checkUpdated()) {
                    api.screq(userAttrRequest)
                        .then(({result: res}) => {
                            if (res === u_handle) {
                                $('.user-name').text(u_attr.name);
                                $('.name', '.account-dialog').text(u_attr.fullname)
                                    .attr('data-simpletip', u_attr.fullname);
                                $('.top-menu-logged .name', '.top-menu-popup').text(u_attr.name);
                                showToast('settings', l[7698]);
                                accountUI.account.profiles.bindEvents();
                                // update file request username for existing folder
                                mega.fileRequest.onUpdateUserName(u_attr.fullname);
                            }
                        })
                        .catch(tell);
                }

                // Reset current Internationalization API usage upon save.
                onIdle(function() {
                    mega.intl.reset();
                });

                $saveBlock.addClass('closed');
                $saveButton.removeClass('disabled');
            });
        },
    },

    qrcode: {

        $QRSettings: null,

        render: function(account) {

            'use strict';

            this.$QRSettings =  $('.qr-settings', accountUI.$contentBlock);

            var QRoptions = {
                width: 106,
                height: 106,
                // high
                correctLevel: QRErrorCorrectLevel.H,
                background: '#f2f2f2',
                foreground: '#151412',
                text: getBaseUrl() + '/' + account.contactLink
            };

            var defaultValue = (account.contactLink && account.contactLink.length);

            $('.qr-http-link', this.$QRSettings).text(QRoptions.text);

            var $container = $('.enable-qr-container', this.$QRSettings);

            if (defaultValue) {
                // Render the QR code
                $('.account.qr-icon', this.$QRSettings).text('').qrcode(QRoptions);
                $('.mega-switch.enable-qr', this.$QRSettings).addClass('toggle-on').trigger('update.accessibility');
                $('.access-qr-container', this.$QRSettings).parent().removeClass('closed');
                $('.qr-block', this.$QRSettings).removeClass('hidden');
                $container.addClass('border');
            }
            else {
                $('.account.qr-icon').text('');
                $('.mega-switch.enable-qr', this.$QRSettings).removeClass('toggle-on').trigger('update.accessibility');
                $('.access-qr-container', this.$QRSettings).parent().addClass('closed');
                $('.qr-block', this.$QRSettings).addClass('hidden');
                $container.removeClass('border');
            }

            // Enable QR code
            accountUI.inputs.switch.init(
                '.enable-qr',
                $container,
                defaultValue,
                function(val) {

                    if (val) {
                        $('.access-qr-container', accountUI.account.qrcode.$QRSettings)
                            .add('.qr-block', accountUI.account.qrcode.$QRSettings)
                            .parent().removeClass('closed');

                        api.send('clc')
                            .then((res) => {
                                account.contactLink = typeof res === 'string' ? `C!${res}` : '';
                                accountUI.account.qrcode.render(M.account);
                            })
                            .catch(dump);
                    }
                    else {
                        $('.access-qr-container', accountUI.account.qrcode.$QRSettings)
                            .add('.qr-settings .qr-block').parent().addClass('closed');

                        api_req({
                            a: 'cld',
                            cl: account.contactLink.substring(2, account.contactLink.length)
                        }, {
                            myAccount: account,
                            callback: function (res, ctx) {

                                if (res === 0) { // success
                                    ctx.myAccount.contactLink = '';
                                }
                            }
                        });
                    }
                },
                function(val) {

                    var promise = new MegaPromise();

                    // If it is toggle off, warn user.
                    if (val) {
                        msgDialog('confirmation', l[19990], l[20128], l[18229], function (answer) {
                            if (answer) {
                                promise.resolve();
                            }
                            else {
                                promise.reject();
                            }
                        });
                    }
                    else {
                        // It is toggle on, just proceed;
                        promise.resolve();
                    }
                    return promise;
                });

            // Automatic accept section
            mega.attr.get(u_handle, 'clv', -2, 0).always(function(res) {

                accountUI.inputs.switch.init(
                    '.auto-qr',
                    $('.access-qr-container', accountUI.account.qrcode.$QRSettings),
                    parseInt(res),
                    function(val) {
                        mega.attr.set('clv', val, -2, 0);
                    });
            });
        },

        bindEvents: function() {

            'use strict';

            // Reset Section
            $('.reset-qr-label', this.$QRSettings).rebind('click', accountUI.account.qrcode.reset);

            // Copy link Section
            if (is_extension || M.execCommandUsable()) {
                $('.copy-qr-link', this.$QRSettings).removeClass('hidden');
                $('.qr-dlg-cpy-lnk', this.$QRSettings).rebind('click', function() {
                    var links = $.trim($(this).next('.qr-http-link').text());
                    var toastTxt = l[1642];
                    copyToClipboard(links, toastTxt);
                });
            }
            else {
                $('.copy-qr-link', this.$QRSettings).addClass('hidden');
            }
        },

        reset: function() {

            'use strict';

            msgDialog('confirmation', l[18227], l[18228], l[18229], function (regenQR) {

                if (regenQR) {
                    loadingDialog.show();

                    api.req({a: 'cld', cl: M.account.contactLink.substring(2)})
                        .then(({result}) => {
                            assert(result === 0);
                            return api.send('clc');
                        })
                        .then((res) => {
                            M.account.contactLink = typeof res === 'string' ? `C!${res}` : '';
                            accountUI.account.qrcode.render(M.account);
                        })
                        .catch(dump)
                        .finally(() => {
                            loadingDialog.hide();
                        });
                }
            });
        }
    },

    preference: {

        render: function() {

            'use strict';

            var self = this;

            // Date/time format setting
            accountUI.inputs.radio.init(
                '.uidateformat',
                $('.uidateformat', accountUI.$contentBlock).parent(),
                fmconfig.uidateformat || 0,
                function (val) {
                    mega.config.setn('uidateformat', parseInt(val), l[16168]);
                }
            );

            // Font size
            accountUI.inputs.radio.init(
                '.uifontsize',
                $('.uifontsize', accountUI.$contentBlock).parent(),
                fmconfig.font_size || 2,
                function (val) {
                    $('body').removeClass('fontsize1 fontsize2').addClass('fontsize' + val);
                    mega.config.setn('font_size', parseInt(val), l[16168]);
                }
            );

            // Theme
            accountUI.inputs.radio.init(
                '.uiTheme',
                $('.uiTheme', accountUI.$contentBlock).parent(),
                u_attr['^!webtheme'] || 0,
                function(val) {
                    mega.attr.set('webtheme', val, -2, 1);
                    mega.ui.setTheme(val);
                }
            );

            self.initHomePageDropdown();

        },

        /**
         * Render and bind events for the home page dropdown.
         * @returns {void}
         */
        initHomePageDropdown: function() {

            'use strict';

            var $hPageSelect = $('.settings-choose-homepage-dropdown', accountUI.$contentBlock);
            var $textField = $('span', $hPageSelect);

            // Mark active item.
            var $activeItem = $('.option[data-value="' + getLandingPage() + '"]', $hPageSelect);
            $activeItem.addClass('active');
            $textField.text($activeItem.text());

            // Bind Dropdowns events
            bindDropdownEvents($hPageSelect, 1);

            $('.option', $hPageSelect).rebind('click.saveChanges', function() {
                var $selectedOption = $('.option[data-state="active"]', $hPageSelect);
                var newValue = $selectedOption.attr('data-value') || 'fm';
                showToast('settings', l[16168]);
                setLandingPage(newValue);
            });
        },
    },

    cancelAccount: {

        bindEvents: function() {

            'use strict';

            // Cancel account button on main Account page
            $('.cancel-account').rebind('click', function() {

                // Please confirm that all your data will be deleted
                var confirmMessage = l[1974];

                if (u_attr.b && u_attr.b.m) {
                    confirmMessage = l.bus_acc_delete_confirm_msg;
                }

                // Search through their Pro plan purchase history
                for (var i = 0; i < M.account.purchases.length; i++) {
                    // Get payment method name
                    var paymentMethodId = M.account.purchases[i][4];
                    var paymentMethod = pro.getPaymentGatewayName(paymentMethodId).name;

                    // If they have paid with iTunes or Google Play in the past
                    if (paymentMethod === 'apple' || paymentMethod === 'google') {
                        // Update confirmation message to remind them to cancel iTunes or Google Play
                        confirmMessage += ' ' + l[8854];
                        break;
                    }
                }

                /**
                 * Finalise the account cancellation process
                 * @param {String|null} twoFactorPin The 2FA PIN code or null if not applicable
                 */
                var continueCancelAccount = function(twoFactorPin) {

                    // Prepare the request
                    var request = { a: 'erm', m: Object(M.u[u_handle]).m, t: 21 };

                    // If 2FA PIN is set, add it to the request
                    if (twoFactorPin !== null) {
                        request.mfa = twoFactorPin;
                    }

                    api_req(request, {
                        callback: function(res) {

                            loadingDialog.hide();

                            // Check for invalid 2FA code
                            if (res === EFAILED || res === EEXPIRED) {
                                msgDialog('warninga', l[135], l[19192]);
                            }

                            // Check for incorrect email
                            else if (res === ENOENT) {
                                msgDialog('warningb', l[1513], l[1946]);
                            }
                            else if (res === 0) {
                                handleResetSuccessDialogs(
                                    l.ac_closure_email_sent_msg.replace('%s', u_attr.email),
                                    'deleteaccount'
                                );
                            }
                            else {
                                msgDialog('warningb', l[135], l[200]);
                            }
                        }
                    });
                };

                // Ask for confirmation
                msgDialog('confirmation', l[6181], confirmMessage, false, function(event) {
                    if (event) {

                        // Check if 2FA is enabled on their account
                        twofactor.isEnabledForAccount()
                            .then((result) => {

                                // If 2FA is enabled on their account
                                if (result) {

                                    // Show the verify 2FA dialog to collect the user's PIN
                                    return twofactor.verifyActionDialog.init();
                                }
                            })
                            .then((twoFactorPin) => continueCancelAccount(twoFactorPin || null))
                            .catch((ex) => ex !== EBLOCKED && tell(ex));
                    }
                });
            });
        }
    }
};

accountUI.plan = {

    init: function(account) {

        "use strict";

        const $planContent = $('.fm-account-plan.fm-account-sections', accountUI.$contentBlock);

        // Plan - Account type
        this.accountType.render(account);
        this.accountType.bindEvents();

        // Plan - Account Balance
        this.balance.render(account);
        this.balance.bindEvents();

        // Plan - History
        this.history.renderPurchase(account);
        this.history.renderTransaction(account);
        this.history.bindEvents(account);

        // Plan - Payment card
        this.paymentCard.init(account, $planContent);

        // check if business account
        if (u_attr && u_attr.b) {
            if (!u_attr.b.m || u_attr.b.s === -1) {
                $('.acc-storage-space', $planContent).addClass('hidden');
                $('.acc-bandwidth-vol', $planContent).addClass('hidden');
            }
            $('.btn-achievements', $planContent).addClass('hidden');
            $('.data-block.account-balance', $planContent).addClass('hidden');
            $('.acc-setting-menu-balance-acc', '.content-panel.account').addClass('hidden');
            $('.upgrade-to-pro', $planContent).addClass('hidden');

            // If Business Master account and if Expired or in Grace Period, show the Reactive Account button
            if (u_attr.b.m && u_attr.b.s !== pro.ACCOUNT_STATUS_ENABLED) {
                $('.upgrade-to-pro', $planContent).removeClass('hidden');
                $('.upgrade-to-pro span', $planContent).text(l.reactivate_account);
            }
        }

        // If Pro Flexi
        if (u_attr && u_attr.pf) {

            // Hide the Upgrade Account button and Account Balance section on the Plan page
            $('.upgrade-to-pro', $planContent).addClass('hidden');
            $('.data-block.account-balance', $planContent).addClass('hidden');

            // Hide Storage space and Transfer quota blocks like Business (otherwise shows 4096 PB which is incorrect)
            if (u_attr.pf.s === pro.ACCOUNT_STATUS_EXPIRED) {
                $('.acc-storage-space', $planContent).addClass('hidden');
                $('.acc-bandwidth-vol', $planContent).addClass('hidden');
            }

            // If Expired or in Grace Period, show the Reactive Account button
            if (u_attr.pf.s !== pro.ACCOUNT_STATUS_ENABLED) {
                $('.upgrade-to-pro', $planContent).removeClass('hidden');
                $('.upgrade-to-pro span', $planContent).text(l.reactivate_account);
            }
        }
    },

    accountType: {

        render: function(account) {

            'use strict';

            var $planContent = $('.data-block.account-type', accountUI.$contentBlock);

            var renderSubscription = function _renderSubscription() {
                // Get the date their subscription will renew
                var timestamp = (account.srenew.length > 0) ? account.srenew[0] : 0; // Timestamp e.g. 1493337569
                var paymentType = (account.sgw.length > 0) ? account.sgw[0] : ''; // Credit Card etc
                var gatewayId = (account.sgwids.length > 0) ? account.sgwids[0] : null; // Gateway ID e.g. 15, etc

                if (paymentType.indexOf('Credit Card') === 0) {
                    paymentType = paymentType.replace('Credit Card', l[6952]);
                }

                // Display the date their subscription will renew if known
                if (timestamp > 0) {
                    var dateString = time2date(timestamp, 2);

                    // Use format: 14 March 2015 - Credit Card
                    paymentType = dateString + ' - ' + paymentType;

                    // Change placeholder 'Expires on' to 'Renews'
                    $('.subtitle-txt.expiry-txt', $planContent).text(l[6971]);
                    $('.account.plan-info.expiry', $planContent).text(paymentType);
                }
                else {
                    // Otherwise show nothing
                    $('.account.plan-info.expiry', $planContent).text('');
                    $('.subtitle-txt.expiry-txt', $planContent).text('');
                }

                var $subscriptionBlock = $('.sub-container.subscription', $planContent);
                var $cancelSubscriptionButton = $('.btn-cancel-sub', $subscriptionBlock);
                var $achievementsButton = $('.btn-achievements', $planContent);

                if (!M.maf){
                    $achievementsButton.addClass('hidden');
                }

                // If Apple or Google subscription (see pro.getPaymentGatewayName function for codes)
                if ((gatewayId === 2) || (gatewayId === 3)) {

                    // Tell them they need to cancel their plan off-site and don't show the feedback dialog
                    $subscriptionBlock.removeClass('hidden');
                    $cancelSubscriptionButton.rebind('click', function() {
                        msgDialog('warninga', l[7179], l[16501]);
                    });
                }

                // Otherwise if ECP, Sabadell, or Stripe
                else if (gatewayId === 16 || gatewayId === 17 || gatewayId === 19) {

                    // Check if there are any active subscriptions
                    // ccqns = Credit Card Query Number of Subscriptions
                    api_req({ a: 'ccqns' }, {
                        callback: function(numOfSubscriptions) {

                            // If there is an active subscription
                            if (numOfSubscriptions > 0) {

                                // Show cancel button and show cancellation dialog
                                $subscriptionBlock.removeClass('hidden');
                                $cancelSubscriptionButton.rebind('click', function() {
                                    accountUI.plan.accountType.cancelSubscriptionDialog.init();
                                });
                            }
                        }
                    });
                }
            };

            if (u_attr.p) {

                // LITE/PRO account
                var planNum = u_attr.p;
                var planText = pro.getProPlanName(planNum);

                // if this is p=100 business
                if (planNum === pro.ACCOUNT_LEVEL_BUSINESS) {
                    $('.account.plan-info.accounttype', $planContent).addClass('business');
                    $('.fm-account-plan .acc-renew-date-info', $planContent).removeClass('border');
                }
                else {
                    $('.account.plan-info.accounttype', $planContent).removeClass('business');
                    $('.fm-account-plan .acc-renew-date-info', $planContent).addClass('border');
                }

                // Account type
                $('.account.plan-info.accounttype span', $planContent).text(planText);
                $('.account .plan-icon', $planContent).addClass('pro' + planNum);

                // Subscription
                if (account.stype === 'S') {
                    renderSubscription();
                }
                else if (account.stype === 'O') {

                    var expiryTimestamp = account.nextplan ? account.nextplan.t : account.expiry;

                    // one-time or cancelled subscription
                    $('.subtitle-txt.expiry-txt', $planContent).text(l[987]);
                    $('.account.plan-info.expiry span', $planContent).text(time2date(expiryTimestamp, 2));
                    $('.sub-container.subscription', $planContent).addClass('hidden');
                }

                $('.account.plan-info.bandwidth', $planContent).parent().removeClass('hidden');
            }
            else {
                // free account:
                $('.account.plan-info.accounttype span', $planContent).text(l[1150]);
                $('.account .plan-icon', $planContent).addClass('free');
                $('.account.plan-info.expiry', $planContent).text(l[436]);
                $('.sub-container.subscription', $planContent).addClass('hidden');
                if (account.mxfer) {
                    $('.account.plan-info.bandwidth', $planContent).parent().removeClass('hidden');
                }
                else {
                    $('.account.plan-info.bandwidth', $planContent).parent().addClass('hidden');
                }
            }

            // If Business or Pro Flexi, override to show the name (even if expired i.e. when u_attr.p is undefined)
            if (u_attr.b || u_attr.pf) {
                $('.account.plan-info.accounttype', $planContent).addClass('business');
                $('.account.plan-info.accounttype span', $planContent).text(
                    pro.getProPlanName(u_attr.b ? pro.ACCOUNT_LEVEL_BUSINESS : pro.ACCOUNT_LEVEL_PRO_FLEXI)
                );
            }

            /* achievements */
            if (!account.maf ||
                (u_attr.p === pro.ACCOUNT_LEVEL_BUSINESS && u_attr.b && u_attr.b.m) ||
                (u_attr.p === pro.ACCOUNT_LEVEL_PRO_FLEXI && u_attr.pf)) {

                $('.btn-achievements', $planContent).addClass('hidden');

                // If active Business master account or active Pro Flexi account
                if ((u_attr.p === pro.ACCOUNT_LEVEL_BUSINESS && u_attr.b && u_attr.b.m) ||
                    (u_attr.p === pro.ACCOUNT_LEVEL_PRO_FLEXI && u_attr.pf)) {

                    // Debug code ...
                    if (d && localStorage.debugNewPrice) {
                        M.account.space_bus_base = 3;
                        M.account.space_bus_ext = 2;
                        M.account.tfsq_bus_base = 3;
                        M.account.tfsq_bus_ext = 1;
                        M.account.tfsq_bus_used = 3848290697216; // 3.5 TB
                        M.account.space_bus_used = 4617948836659; // 4.2 TB
                    }
                    // END Debug code

                    const renderBars = (used, base, extra, $container, msg, $overall) => {
                        let spaceTxt = `${bytesToSize(used)}`;
                        let baseTxt = spaceTxt;
                        let storageConsume = used / 1048576; // MB
                        let storageQuota = (base || 3) * 1048576; // MB
                        let extraTxt = l[5816].replace('[X]', base || 3);

                        if (base) {

                            spaceTxt += `/${l[5816]
                                .replace('[X]', base + (extra || 0))}`;

                            if (extra) {
                                storageConsume = base;
                                storageQuota = base + extra;
                                baseTxt = extraTxt;
                                extraTxt = msg.replace('%1', extra);
                            }
                        }

                        $('.settings-sub-bar', $container)
                            .css('width', `${100 - storageConsume * 100 / storageQuota}%`);
                        $('.base-quota-note span', $container).text(baseTxt);
                        $('.achieve-quota-note span', $container).text(extraTxt);
                        $overall.text(spaceTxt);
                    };

                    const $storageContent = $('.acc-storage-space', $planContent);
                    const $bandwidthContent = $('.acc-bandwidth-vol', $planContent);

                    renderBars(M.account.space_bus_used || M.account.space_used, M.account.space_bus_base,
                               M.account.space_bus_ext, $storageContent, l.additional_storage,
                               $('.plan-info.storage > span', $planContent));

                    renderBars(M.account.tfsq_bus_used || M.account.tfsq.used, M.account.tfsq_bus_base,
                               M.account.tfsq_bus_ext, $bandwidthContent, l.additional_transfer,
                               $('.plan-info.bandwidth > span', $planContent));

                    $('.bars-container', $planContent).removeClass('hidden');
                }
                else {
                    $('.plan-info.storage > span', $planContent).text(bytesToSize(M.account.space, 0));
                    $('.plan-info.bandwidth > span', $planContent).text(bytesToSize(M.account.tfsq.max, 0));
                    $('.bars-container', $planContent).addClass('hidden');
                }
            }
            else {
                mega.achievem.parseAccountAchievements();
            }
        },

        bindEvents: function() {

            "use strict";

            $('.btn-achievements', accountUI.$contentBlock).rebind('click', function() {
                mega.achievem.achievementsListDialog();
            });
        },

        /**
         * Dialog to cancel subscriptions
         */
        cancelSubscriptionDialog: {

            $backgroundOverlay: null,
            $dialog: null,
            $dialogSuccess: null,
            $accountPageCancelButton: null,
            $options: null,
            $formContent: null,
            $selectReasonDialog: null,
            $selectCanContactError: null,
            $invalidDetailsDialog: null,
            $continueButton: null,
            $textareaAndErrorDialog: null,
            $textarea: null,
            $cancelReason: null,
            $expiryTextBlock: null,
            $expiryDateBlock: null,

            /**
             * Initialise the dialog
             */
            init: function() {

                'use strict';

                // Cache some selectors
                this.$benefitsCancelDialog = $('.cancel-subscription-benefits');
                this.$dialog = $('.cancel-subscription-st1');
                this.$dialogSuccess = $('.cancel-subscription-st2');
                this.$accountPageCancelButton = $('.btn-cancel-sub');
                this.$formContent = this.$dialog.find('section.content');
                this.$selectReasonDialog = this.$dialog.find('.error-banner.select-reason');
                this.$selectCanContactError = $('.error-banner.select-can-contact', this.$dialog);
                this.$invalidDetailsDialog = this.$dialog.find('.error-banner.invalid-details');
                this.$continueButton = this.$dialog.find('.cancel-subscription');
                this.$textareaAndErrorDialog = this.$dialog.find('.textarea-and-banner');
                this.$textarea = this.$dialog.find('textarea');
                this.$cancelReason = $('.cancel-textarea-bl', this.$textareaAndErrorDialog);
                this.$backgroundOverlay = $('.fm-dialog-overlay');
                this.$expiryTextBlock = $('.account.plan-info.expiry-txt');
                this.$expiryDateBlock = $('.account.plan-info.expiry');

                const options = {
                    temp_plan: 1,
                    too_expensive: 2,
                    too_much_storage_quota: 3,
                    lack_of_features: 4,
                    switching_provider: 5,
                    difficult_to_use: 6,
                    poor_support: 7
                };

                // Shuffle the options
                const optionArray = Object.keys(options);
                for (let i = optionArray.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [optionArray[i], optionArray[j]] = [optionArray[j], optionArray[i]];
                }

                const $template = $('.cancel-subscription-radio-template', this.$dialog);
                const $optionArea = $('.content-block form.cancel-options', this.$dialog);
                $optionArea.children('.built-option').remove();

                for (let i = 0; i < optionArray.length; i++) {
                    const $radio = $template.clone().removeClass('hidden cancel-subscription-radio-template');
                    $('#subcancel_div', $radio).removeAttr('id');
                    $('#subcancel', $radio).val(options[optionArray[i]]).removeAttr('id');
                    $('.radio-txt', $radio).text(l['cancel_sub_' + optionArray[i] + '_reason']);
                    $optionArea.safePrepend($radio.prop('outerHTML'));
                }

                this.$options = this.$dialog.find('.label-wrap');
                this.$allowContactOptions = $('.allow-contact-wrapper', this.$dialog);

                // Show benefits dialog before cancellation dialog if user does not have Pro Flex or Business
                if (pro.filter.simple.canSeeCancelBenefits.has(u_attr.p)) {
                    this.displayBenefits();
                }
                else {
                    this.$dialog.removeClass('hidden');
                }
                this.$backgroundOverlay.removeClass('hidden').addClass('payment-dialog-overlay');

                // Init textarea scrolling
                initTextareaScrolling($('.cancel-textarea textarea', this.$dialog));

                // Init section scrolling
                if (this.$formContent.is('.ps')) {
                    this.$formContent.scrollTop(0);
                    Ps.destroy(this.$formContent[0]);
                }

                // Init functionality
                this.resetCancelSubscriptionForm();
                this.checkReasonEnteredIsValid();
                this.initClickReason();
                this.initClickContactConfirm();
                this.initCloseAndDontCancelButtons();

                this.$continueButton.rebind('click', () => {
                    this.sendSubCancelRequestToApi();
                });
            },

            /**
             * Reset the form incase the user changes their mind and closes it,
             * so they always see a blank form if they choose to cancel their subscription again
             */
            resetCancelSubscriptionForm: function() {

                'use strict';

                this.$selectReasonDialog.addClass('hidden');
                this.$selectCanContactError.addClass('hidden');
                this.$invalidDetailsDialog.addClass('hidden');
                this.$textareaAndErrorDialog.addClass('hidden');
                this.$dialog.removeClass('textbox-open error-select-reason error-select-contact');
                this.$cancelReason.removeClass('error');
                this.$textarea.val('');
                $('.cancel-option', this.$options).addClass('radioOff').removeClass('radioOn');
                $('.contact-option', this.$allowContactOptions).addClass('radioOff').removeClass('radioOn');
            },

            fillBenefits: async function($keepPlanBtn) {

                'use strict';

                const callback = async(data) => {
                    let planDuration = data.scycle;
                    let subscription = data.slevel;
                    if (!planDuration || !subscription) {
                        await api.req({a: 'uq', pro: u_attr.p}).then(res => {
                            planDuration = res.result.scycle;
                            subscription = res.result.slevel;
                        });
                    }

                    // If plan duration is not an expected value, skip the benefits dialog
                    if (planDuration !== '1 M' && planDuration !== '1 Y') {
                        this.$dialog.removeClass('hidden');
                        return;
                    }

                    const $cancelDialog = this.$benefitsCancelDialog;

                    const duration = planDuration === '1 Y' ? 12 : 1;

                    const plan = pro.membershipPlans.find(plan =>
                        (plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL] === subscription)
                        && (plan[pro.UTQA_RES_INDEX_MONTHS] === duration));

                    const proPlanName = pro.getProPlanName(subscription);
                    const freeStorage = bytesToSize(20 * 1024 * 1024 * 1024, 0);
                    const proStorage = bytesToSize(plan[pro.UTQA_RES_INDEX_STORAGE] * 1073741824, 0);
                    const freeTransfer = l['1149'];
                    const proTransfer = bytesToSize(plan[pro.UTQA_RES_INDEX_TRANSFER] * 1073741824, 0);
                    const rewindTxt = mega.icu.format(l.pr_up_to_days, pro.filter.simple.ninetyDayRewind
                        .has(plan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL]) ? 90 : 180);

                    $('.pro-storage', $cancelDialog).text(proStorage);
                    $('.free-storage', $cancelDialog).text(freeStorage);
                    $('.pro-transfer', $cancelDialog).text(proTransfer);
                    $('.free-transfer', $cancelDialog).text(freeTransfer);
                    $('.plan-name', $cancelDialog).text(proPlanName);
                    $('.rewind-pro', $cancelDialog).text(rewindTxt);
                    $('.rewind-free', $cancelDialog).text(mega.icu.format(l.days_chat_history_plural, 30));
                    $('.meet-participants', $cancelDialog).text(l.pr_meet_up_to_participants.replace('%1', 100));
                    $('.meet-duration', $cancelDialog).text(mega.icu.format(l.pr_meet_up_to_duration, 1));


                    $('span', $keepPlanBtn)
                        .text(l.cancel_pro_keep_current_plan.replace('%1', pro.getProPlanName(subscription)));

                    $cancelDialog.removeClass('hidden');
                };

                M.accountData(callback);
            },

            displayBenefits: function() {

                'use strict';

                const {$benefitsCancelDialog, $dialog, $backgroundOverlay} = this;

                const $closeBtn = $('.js-close', $benefitsCancelDialog);
                const $continueBtn = $('.js-continue', $benefitsCancelDialog);
                const $keepPlanBtn = $('.js-keep-plan', $benefitsCancelDialog);

                const closeBenefits = () => {
                    $benefitsCancelDialog.addClass('hidden');
                    $backgroundOverlay.addClass('hidden').removeClass('payment-dialog-overlay');
                };

                $closeBtn.rebind('click', closeBenefits);
                $keepPlanBtn.rebind('click', closeBenefits);

                $continueBtn.rebind('click', () => {
                    $benefitsCancelDialog.addClass('hidden');
                    $dialog.removeClass('hidden');
                });
                loadingDialog.show();
                pro.loadMembershipPlans(() => {
                    this.fillBenefits($keepPlanBtn).then(() => {
                        loadingDialog.hide();
                    });
                });
            },

            /**
             * Close the dialog when either the close or "Don't cancel" buttons are clicked
             */
            initCloseAndDontCancelButtons: function() {

                'use strict';

                var self = this;

                // Close main dialog
                self.$dialog.find('button.dont-cancel, button.js-close').rebind('click', () => {
                    self.$dialog.addClass('hidden');
                    self.$backgroundOverlay.addClass('hidden').removeClass('payment-dialog-overlay');
                });
            },

            /**
             * Set the radio button classes when a radio button or its text are clicked
             */
            initClickReason: function() {
                'use strict';

                this.$options.rebind('click', (e) => {
                    const $option = $(e.currentTarget);
                    const value = $('input', $option).val();
                    const valueIsOtherOption = value === "8";

                    $('.cancel-option', this.$options).addClass('radioOff').removeClass('radioOn');
                    $('.cancel-option', $option).addClass('radioOn').removeClass('radioOff');

                    this.$selectReasonDialog.addClass('hidden');
                    this.$dialog.removeClass('error-select-reason');
                    this.$textareaAndErrorDialog.toggleClass('hidden', !valueIsOtherOption);
                    this.$dialog.toggleClass('textbox-open', valueIsOtherOption);

                    if (valueIsOtherOption) {
                        Ps.initialize(this.$formContent[0]);
                        this.$invalidDetailsDialog.toggleClass('hidden', !(this.$cancelReason.hasClass('error')));

                        this.$formContent.scrollTop(this.$formContent.height());
                        this.$textarea.trigger('focus');
                    }
                    else {
                        if (this.$formContent.is('.ps')) {
                            this.$formContent.scrollTop(0);
                            Ps.destroy(this.$formContent[0]);
                        }

                        this.$invalidDetailsDialog.addClass('hidden');
                        this.$textarea.trigger('blur');
                    }
                });
            },

            initClickContactConfirm() {

                'use strict';

                this.$allowContactOptions.rebind('click', (e) => {

                    const $option = $(e.currentTarget);
                    $('.contact-option', this.$allowContactOptions).addClass('radioOff').removeClass('radioOn');
                    $('.contact-option', $option).addClass('radioOn').removeClass('radioOff');

                    this.$selectCanContactError.addClass('hidden');
                    this.$dialog.removeClass('error-select-contact');
                });
            },

            /**
             * Close success dialog
             */
            initCloseButtonSuccessDialog: function() {

                'use strict';

                var self = this;

                self.$dialogSuccess.find('button.js-close').rebind('click', () => {
                    self.$dialogSuccess.addClass('hidden');
                    self.$backgroundOverlay.addClass('hidden').removeClass('payment-dialog-overlay');
                });
            },

            /**
             * Check the user has entered between 1 and 1000 characters into the text field
             */
            checkReasonEnteredIsValid: function() {

                'use strict';

                var self = this;

                self.$textarea.rebind('keyup', function() {
                    // Trim for spaces
                    var reason = $(this).val();
                    reason = $.trim(reason);

                    const responseIsValid = reason.length > 0 && reason.length <= 1000;

                    // Make sure response is between 1 and 1000 characters
                    if (responseIsValid) {
                        self.$invalidDetailsDialog.addClass('hidden');
                        self.$cancelReason.removeClass('error');
                    }
                    else {
                        self.showTextareaError(!reason.length);
                    }
                });
            },

            /**
             * Show the user an error message below the text field if their input is
             * invalid, or too long
             */
            showTextareaError: function(emptyReason) {
                'use strict';

                var self = this;

                self.$invalidDetailsDialog.removeClass('hidden');

                if (emptyReason) {
                    self.$invalidDetailsDialog.text(l.cancel_sub_empty_textarea_error_msg);
                }
                else {
                    self.$invalidDetailsDialog.text(l.cancel_sub_too_much_textarea_input_error_msg);
                }

                self.$cancelReason.addClass('error');
                self.$formContent.scrollTop(self.$formContent.height());
            },

            /**
             * Send the subscription cancellation request to the API
             */
            sendSubCancelRequestToApi() {
                'use strict';

                let reason;

                const $optionSelected = $('.cancel-option.radioOn', this.$options);
                const isReasonSelected = $optionSelected.length;

                const $selectedContactOption = $('.contact-option.radioOn', this.$allowContactOptions);
                const isContactOptionSelected = $selectedContactOption.length;

                if (!isReasonSelected || !isContactOptionSelected) {
                    if (!isReasonSelected) {
                        this.$selectReasonDialog.removeClass('hidden');
                        this.$dialog.addClass('error-select-reason');
                    }
                    if (!isContactOptionSelected) {
                        this.$selectCanContactError.removeClass('hidden');
                        this.$dialog.addClass('error-select-contact');
                    }
                    return;
                }

                const value = $('input', $optionSelected).val();
                const radioText = $('.radio-txt', $optionSelected.parent()).text().trim();
                const canContactUser = $('input', $selectedContactOption).val() | 0;

                // The cancellation reason (r) sent to the API is the radio button text, or
                // when the chosen option is "Other (please provide details)" it is
                // what the user enters in the text field
                if (value === "8") {
                    reason = this.$textarea.val().trim();

                    if (!reason.length || reason.length > 1000) {
                        this.showTextareaError(!reason.length);
                        return;
                    }
                }
                else {
                    reason = value + ' - ' + radioText;
                }

                // Hide the dialog and show loading spinner
                this.$dialog.addClass('hidden');
                this.$backgroundOverlay.addClass('hidden').removeClass('payment-dialog-overlay');
                loadingDialog.show();

                // Setup standard request to 'cccs' = Credit Card Cancel Subscriptions
                const requests = [
                    { a: 'cccs', r: reason, cc: canContactUser}
                ];

                // If they were Pro Flexi, we need to also downgrade the user from Pro Flexi to Free
                if (u_attr && u_attr.pf) {
                    requests.push({ a: 'urpf' });
                }

                // Cancel the subscription/s
                api_req(requests, {
                    callback: () => {

                        // Hide loading dialog and cancel subscription button on
                        // account page, set expiry date
                        loadingDialog.hide();
                        this.$accountPageCancelButton.addClass('hidden');
                        this.$expiryTextBlock.text(l[987]);
                        this.$expiryDateBlock
                            .safeHTML('<span class="red">@@</span>', time2date(account.expiry, 2));

                        // Show success dialog
                        this.$dialogSuccess.removeClass('hidden');
                        this.$backgroundOverlay.removeClass('hidden');
                        this.$backgroundOverlay.addClass('payment-dialog-overlay');
                        this.initCloseButtonSuccessDialog();

                        // Reset account cache so all account data will be refetched
                        // and re-render the account page UI
                        M.account.lastupdate = 0;
                        accountUI();
                    }
                });
            }
        }
    },

    paymentCard: {

        $paymentSection: null,

        validateCardResponse: function(res) {
            'use strict';
            return res && (res.gw === (addressDialog || {}).gatewayId_stripe || 19) && res.brand && res.last4
                && res.exp_month && res.exp_year;
        },

        validateUser: function(account) {
            'use strict';
            return (u_attr.p || u_attr.b) && account.stype === 'S'
                && ((Array.isArray(account.sgw) && account.sgw.includes('Stripe'))
                    || (Array.isArray(account.sgwids)
                        && account.sgwids.includes((addressDialog || {}).gatewayId_stripe || 19)));
        },

        init: function(account, $planSection) {
            'use strict';

            this.$paymentSection = $('.account.account-card-info', $planSection);

            const hideCardSection = () => {
                this.$paymentSection.addClass('hidden');

                $('.settings-button .acc-setting-menu-card-info', '.content-panel.account')
                    .addClass('hidden');
            };

            // check if we should show the section (uq response)
            if (this.validateUser(account)) {

                api_req({ a: 'cci' }, {
                    callback: (res) => {
                        if (typeof res === 'object' && this.validateCardResponse(res)) {
                            return this.render(res);
                        }

                        hideCardSection();
                    }
                });
            }
            else {
                hideCardSection();
            }
        },

        render: function(cardInfo) {
            'use strict';

            if (cardInfo && this.$paymentSection) {


                if (cardInfo.brand === 'visa') {

                    this.$paymentSection.addClass('visa').removeClass('mc');
                    $('.payment-card-icon i', this.$paymentSection)
                        .removeClass('sprite-fm-uni icon-mastercard-border');

                }
                else if (cardInfo.brand === 'mastercard') {

                    this.$paymentSection.addClass('mc').removeClass('visa');
                    $('.payment-card-icon i', this.$paymentSection).addClass('sprite-fm-uni icon-mastercard-border');

                }
                else {
                    this.$paymentSection.removeClass('visa mc');
                }

                $('.payment-card-nb .payment-card-digits', this.$paymentSection).text(cardInfo.last4);
                $('.payment-card-expiry .payment-card-expiry-val', this.$paymentSection)
                    .text(`${String(cardInfo.exp_month).padStart(2, '0')}/${String(cardInfo.exp_year).substr(-2)}`);

                $('.payment-card-bottom a.payment-card-edit', this.$paymentSection).rebind('click', () => {

                    loadingDialog.show();

                    api.send('gw19_ccc')
                        .then((res) => {
                            assert(typeof res === 'string');
                            addressDialog.processUtcResult({EUR: res, edit: true}, true);
                        })
                        .catch((ex) => {
                            msgDialog('warninga', '', l.edit_card_error.replace('%1', ex), l.edit_card_error_des);
                        })
                        .finally(() => loadingDialog.hide());
                });

                this.$paymentSection.removeClass('hidden');
            }
        }

    },

    balance: {

        render: function(account) {

            "use strict";

            $('.account.plan-info.balance span', accountUI.$contentBlock).safeHTML(
                '&euro; @@',
                mega.intl.number.format(account.balance[0][0])
            );
        },

        bindEvents: function() {

            "use strict";

            var self = this;

            $('.redeem-voucher', accountUI.$contentBlock).rebind('click', function() {
                var $this = $(this);
                if ($this.attr('class').indexOf('active') === -1) {
                    $('.fm-account-overlay').fadeIn(100);
                    $this.addClass('active');
                    $('.fm-voucher-popup').removeClass('hidden');

                    $('.fm-account-overlay, .fm-purchase-voucher, .fm-voucher-button')
                        .add('.fm-voucher-popup button.js-close')
                        .rebind('click.closeDialog', function() {
                            $('.fm-account-overlay').fadeOut(100);
                            $('.redeem-voucher').removeClass('active');
                            $('.fm-voucher-popup').addClass('hidden');
                        });
                }
                else {
                    $('.fm-account-overlay').fadeOut(200);
                    $this.removeClass('active');
                    $('.fm-voucher-popup').addClass('hidden');
                }
            });

            $('.fm-voucher-button').rebind('click.voucherBtnClick', function() {
                var $input = $('.fm-voucher-body input');
                var code = $input.val();

                $input.val('');
                loadingDialog.show();
                $('.fm-voucher-popup').addClass('hidden');

                M.require('redeem_js')
                    .then(function() {
                        return redeem.redeemVoucher(code);
                    })
                    .then(function() {
                        Object(M.account).lastupdate = 0;
                        onIdle(accountUI);
                    })
                    .catch(function(ex) {
                        loadingDialog.hide();
                        if (ex) {
                            let sub;
                            if (ex === ETOOMANY) {
                                ex = l.redeem_etoomany;
                            }
                            else if (ex === EACCESS) {
                                ex = l[714];
                            }
                            else if (ex < 0) {
                                ex = `${l[473]} (${ex})`;
                            }
                            else {
                                sub = ex;
                                ex = l[47];
                            }
                            msgDialog('warninga', l[135], ex, sub);
                        }
                    });
            });

            $('.fm-purchase-voucher, button.topup').rebind('click', function() {
                mega.redirect('mega.io', 'resellers', false, false, false);
            });
        }
    },

    history: {

        renderPurchase: function(account) {

            'use strict';

            var $purchaseSelect = $('.dropdown-input.purchases', accountUI.$contentBlock);

            if (!$.purchaselimit) {
                $.purchaselimit = 10;
            }

            $('span', $purchaseSelect).text(mega.icu.format(l[469], $.purchaselimit));
            $('.purchase10-', $purchaseSelect).text(mega.icu.format(l[469], 10));
            $('.purchase100-', $purchaseSelect).text(mega.icu.format(l[469], 100));
            $('.purchase250-', $purchaseSelect).text(mega.icu.format(l[469], 250));

            M.account.purchases.sort(function(a, b) {
                if (a[1] < b[1]) {
                    return 1;
                }
                else {
                    return -1;
                }
            });

            $('.data-table.purchases tr', accountUI.$contentBlock).remove();
            var html = '<tr><th>' + l[476] + '</th><th>' + l[475] +
                '</th><th>' + l[477] + '</th><th>' + l[478] + '</th></tr>';
            if (account.purchases.length) {

                // Render every purchase made into Purchase History on Account page
                $(account.purchases).each(function(index, purchaseTransaction) {

                    if (index === $.purchaselimit) {
                        return false;// Break the loop
                    }

                    // Set payment method
                    const paymentMethodId = purchaseTransaction[4];
                    const paymentMethod = pro.getPaymentGatewayName(paymentMethodId).displayName;

                    // Set Date/Time, Item (plan purchased), Amount, Payment Method
                    const dateTime = time2date(purchaseTransaction[1]);
                    const price = formatCurrency(purchaseTransaction[2], 'EUR', 'narrowSymbol');
                    const proNum = purchaseTransaction[5];
                    let planIcon;
                    const numOfMonths = purchaseTransaction[6];
                    const monthWording = numOfMonths === 1 ? l[931] : l[6788];
                    const item = `${pro.getProPlanName(proNum)} (${numOfMonths} ${monthWording})`;

                    if (proNum === pro.ACCOUNT_LEVEL_PRO_LITE) {
                        planIcon = 'icon-crest-lite';
                    }
                    else if (proNum === pro.ACCOUNT_LEVEL_BUSINESS) {
                        planIcon = 'icon-crest-business';
                    }
                    else if (proNum === pro.ACCOUNT_LEVEL_PRO_FLEXI) {
                        planIcon = 'icon-crest-pro-flexi';
                    }
                    else if (pro.filter.simple.hasIcon.has(proNum)) {
                        planIcon = 'icon-crest-pro-' + proNum;
                    }

                    // Render table row
                    html += '<tr>'
                        + '<td><div class="label-with-icon">'
                        + (planIcon ? '<i class="sprite-fm-uni ' + planIcon + '"></i>' : '')
                        + '<span> ' + item + '</span>'
                        + '</div></td>'
                        + '<td><span>' + dateTime + '</span></td>'
                        + '<td><span>' + escapeHTML(price) + '</span></td>'
                        + '<td><span>' + paymentMethod + '</span></td>'
                        + '</tr>';
                });
            }
            else {
                html += '<tr><td colspan="4" class="data-table-empty"><span>' + l[20140] + '</span></td></tr>';
            }

            $('.data-table.purchases', accountUI.$contentBlock).safeHTML(html);
        },

        renderTransaction: function(account) {

            'use strict';

            var $transactionSelect = $('.dropdown-input.transactions', accountUI.$contentBlock);

            if (!$.transactionlimit) {
                $.transactionlimit = 10;
            }

            $('span', $transactionSelect).text(mega.icu.format(l[471], $.transactionlimit));
            $('.transaction10-', $transactionSelect).text(mega.icu.format(l[471], 10));
            $('.transaction100-', $transactionSelect).text(mega.icu.format(l[471], 100));
            $('.transaction250-', $transactionSelect).text(mega.icu.format(l[471], 250));

            M.account.transactions.sort(function(a, b) {
                if (a[1] < b[1]) {
                    return 1;
                }
                else {
                    return -1;
                }
            });

            $('.data-table.transactions tr', accountUI.$contentBlock).remove();
            var html = '<tr><th>' + l[475] + '</th><th>' + l[484] +
                '</th><th>' + l[485] + '</th><th>' + l[486] + '</th></tr>';
            if (account.transactions.length) {
                var intl = mega.intl.number;
                $(account.transactions).each(function(i, el) {

                    if (i === $.transactionlimit) {
                        return false;
                    }

                    var credit = '';
                    var debit = '';

                    if (el[2] > 0) {
                        credit = '<span class="green-label">&euro;' + escapeHTML(intl.format(el[2])) + '</span>';
                    }
                    else {
                        debit = '<span class="red-label">&euro;' + escapeHTML(intl.format(el[2])) + '</span>';
                    }
                    html += '<tr><td>' + time2date(el[1]) + '</td><td>' + htmlentities(el[0]) + '</td><td>'
                        + credit + '</td><td>' + debit + '</td></tr>';
                });
            }
            else {
                html += '<tr><td colspan="4" class="data-table-empty">' + l[20140] + '</td></tr>';
            }

            $('.data-table.transactions', accountUI.$contentBlock).safeHTML(html);
        },

        bindEvents: function() {

            'use strict';

            var $planSection = $('.fm-account-plan', accountUI.$contentBlock);
            var $planSelects = $('.dropdown-input', $planSection);

            // Bind Dropdowns events
            bindDropdownEvents($planSelects);

            $('.mega-input-dropdown .option', $planSection).rebind('click.accountSection', function() {

                var c = $(this).attr('class') ? $(this).attr('class') : '';

                if (c.indexOf('purchase10-') > -1) {
                    $.purchaselimit = 10;
                }
                else if (c.indexOf('purchase100-') > -1) {
                    $.purchaselimit = 100;
                }
                else if (c.indexOf('purchase250-') > -1) {
                    $.purchaselimit = 250;
                }

                if (c.indexOf('transaction10-') > -1) {
                    $.transactionlimit = 10;
                }
                else if (c.indexOf('transaction100-') > -1) {
                    $.transactionlimit = 100;
                }
                else if (c.indexOf('transaction250-') > -1) {
                    $.transactionlimit = 250;
                }

                accountUI();
            });
        }
    }
};

accountUI.notifications = {

    helpURL: 'chats-meetings/meetings/enable-notification-browser-system-permission',
    permissions: {
        granted: 'granted',
        denied: 'denied',
        pending: 'default'
    },

    init: function() {

        'use strict';

        this.render();
        this.handleChatNotifications();
    },

    render: function() {

        'use strict';

        // Ensure the loading dialog stays open till enotif is finished.
        loadingDialog.show('enotif');

        // New setting need to force cloud and contacts notification available.
        if (!mega.notif.has('enabled', 'cloud')) {
            mega.notif.set('enabled', 'cloud');
        }

        if (!mega.notif.has('enabled', 'contacts')) {
            mega.notif.set('enabled', 'contacts');
        }

        // Handle account notification switches
        const { notif } = mega;
        const $notificationContent = $('.fm-account-notifications', accountUI.$contentBlock);
        const $NToggleAll = $('.account-notification .mega-switch.toggle-all', $notificationContent);
        const $NToggle = $('.account-notification .switch-container .mega-switch', $notificationContent);

        // Toggle individual notifications
        for (let i = $NToggle.length; i--;) {
            const el = $NToggle[i];
            const sectionEl = $(el).closest('.switch-container');
            const section = accountUI.notifications.getSectionName(sectionEl);

            accountUI.inputs.switch.init(
                `#${el.id}`,
                sectionEl,
                notif.has(el.getAttribute('name'), section),
                val => {
                    notif[val ? 'set' : 'unset'](el.getAttribute('name'), section);

                    if (val) {
                        $NToggleAll.addClass('toggle-on');
                        if (section === 'chat') {
                            this.renderNotification();
                        }
                    }
                    else {
                        ($NToggle.hasClass('toggle-on') ? $.fn.addClass : $.fn.removeClass)
                            .apply($NToggleAll, ['toggle-on']);
                    }
                    $NToggleAll.trigger('update.accessibility');
                }
            );
        }

        // Toggle All Notifications
        accountUI.inputs.switch.init(
            '#' + $NToggleAll[0].id,
            $NToggleAll.parent(),
            $NToggle.hasClass('toggle-on'),
            function(val) {
                $NToggle.each(function() {
                    var $this = $(this);
                    var $section = $this.closest('.switch-container');
                    var sectionName = accountUI.notifications.getSectionName($section);

                    const invert = $this.attr('name') === 'upload' ? !val : val;
                    const notifChange = invert ? mega.notif.set : mega.notif.unset;

                    notifChange($this.attr('name'), sectionName);

                    (val ? $.fn.addClass : $.fn.removeClass).apply($this, ['toggle-on']);
                    $this.trigger('update.accessibility');
                });
            }
        );

        // Hide achievements toggle if achievements not an option for this user.
        if (!M.account.maf) {
            $('#enotif-achievements').closest('.switch-container').remove();
        }

        // Handle email notification switches.
        var $EToggleAll = $('.email-notification .mega-switch.toggle-all', $notificationContent);
        var $EToggle = $('.email-notification .switch-container .mega-switch', $notificationContent);

        mega.enotif.all().then(function(enotifStates) {
            // Toggle Individual Emails
            $EToggle.each(function() {
                var $this = $(this);
                var $section = $this.closest('.switch-container');
                var emailId = $this.attr('name');

                accountUI.inputs.switch.init(
                    '#' + this.id,
                    $section,
                    !enotifStates[emailId],
                    function(val) {
                        mega.enotif.setState(emailId, !val);
                        (val || $EToggle.hasClass('toggle-on') ? $.fn.addClass : $.fn.removeClass)
                            .apply($EToggleAll, ['toggle-on']);
                        $EToggleAll.trigger('update.accessibility');
                    }
                );
            });

            // All Email Notifications Switch
            accountUI.inputs.switch.init(
                '#' + $EToggleAll[0].id,
                $EToggleAll.closest('.settings-sub-section'),
                $EToggle.hasClass('toggle-on'),
                function(val) {
                    mega.enotif.setAllState(!val);
                    (val ? $.fn.addClass : $.fn.removeClass).apply($EToggle, ['toggle-on']);
                    $EToggle.trigger('update.accessibility');
                }
            );

            if (accountUI.plan.paymentCard.validateUser(M.account)) {
                $('.switch-container.card-exp-switch', $notificationContent).removeClass('hidden');
            }

            // Hide the loading screen.
            loadingDialog.hide('enotif');
        });
    },

    getSectionName: function($section) {

        'use strict';

        var section = String($section.attr('class')).split(" ").filter(function(c) {
            return ({
                'chat': 1,
                'contacts': 1,
                'cloud-drive': 1
            })[c];
        });
        return String(section).split('-').shift();

    },

    renderNotification() {
        'use strict';
        return new Notification(l.notification_granted_title, { body: l.notification_granted_body });
    },

    onPermissionsGranted() {
        'use strict';
        msgDialog(
            'info',
            '',
            l.notifications_permissions_granted_title,
            l.notifications_permissions_granted_info
                .replace(
                    '[A]',
                    `<a href="${l.mega_help_host}/${this.helpURL}" target="_blank" class="clickurl">`
                )
                .replace('[/A]', '</a>')
        );
        this.renderNotification();
    },

    requestPermission() {
        'use strict';
        Notification.requestPermission()
            .then(permission => {
                if (permission === this.permissions.granted) {
                    this.onPermissionsGranted();
                }
                mBroadcaster.sendMessage('meetings:notificationPermissions', permission);
            })
            .then(() => this.handleChatNotifications())
            .catch(ex => d && console.warn(`Failed to retrieve permissions: ${ex}`));
    },

    handleChatNotifications() {
        'use strict';

        const $container = $('.switch-container.chat', accountUI.$contentBlock);
        const $banner = $('.chat-permissions-banner', $container);
        const $body = $('.versioning-body-text', $banner);

        if (window.Notification && mega.notif.has('enabled', 'chat')) {
            const { permission } = Notification;
            const { granted, denied, pending } = this.permissions;
            Object.values(this.permissions).forEach(p => $banner.removeClass(`permission--${p}`));

            // Toggle the inline browser permissions banner based
            // on the current browser permissions state
            switch (true) {
                case permission === granted:
                    $body.safeHTML(
                        l.notification_settings_granted
                            .replace(
                                '[A]',
                                `<a
                                    href="${l.mega_help_host}/${this.helpURL}"
                                    target="_blank"
                                    class="clickurl notif-help">
                                `
                            )
                            .replace('[/A]', '</a>')
                    );
                    $banner.addClass(`permission--${granted}`);
                    break;
                case permission === denied:
                    $body.safeHTML(
                        l.notifications_permissions_denied_info
                            .replace(
                                '[A]',
                                `<a
                                    href="${l.mega_help_host}/${this.helpURL}"
                                    target="_blank"
                                    class="clickurl notif-help">
                                `
                            )
                            .replace('[/A]', '</a>')
                    );
                    $banner.addClass(`permission--${denied} warning-template`);
                    break;
                default:
                    $body.safeHTML(
                        l.notification_settings_pending
                            .replace(
                                '[1]',
                                `<a
                                    href="${l.mega_help_host}/${this.helpURL}"
                                    target="_blank"
                                    class="clickurl notif-help">
                                `
                            )
                            .replace('[/1]', '</a>')
                            .replace('[2]', '<a href="#" class="request-notification-permissions">')
                            .replace('[/2]', '</a>')
                    );
                    $('.request-notification-permissions', $banner).rebind('click', () => this.requestPermission());
                    $banner.addClass(`permission--${pending}`);
                    break;
            }

            return $banner.removeClass('hidden');
        }

        // Don't display the browser permissions banner if
        // `Chat notifications` are disabled
        return $banner.addClass('hidden');
    }
};

accountUI.security = {

    init: function() {

        "use strict";

        // Change Password
        accountChangePassword.init();

        // Change Email
        if (!u_attr.b || u_attr.b.m) {
            $('.fm-account-security.fm-account-sections .data-block.change-email').removeClass('hidden');
            $('.content-panel.account .acc-setting-menu-change-em').removeClass('hidden');

            accountChangeEmail.init();
        }
        else {
            $('.fm-account-security.fm-account-sections .data-block.change-email').addClass('hidden');
            $('.content-panel.account .acc-setting-menu-change-em').addClass('hidden');
        }

        // Recovery Key
        this.recoveryKey.bindEvents();

        // Metadata
        this.metadata.render();

        // Session
        this.session.render();
        this.session.bindEvents();

        // 2fa
        twofactor.account.init();
    },

    recoveryKey: {

        bindEvents: function() {

            'use strict';

            // Button on main Account page to backup their master key
            $('.fm-account-security .backup-master-key').rebind('click', function() {
                M.showRecoveryKeyDialog(2);
            });
        }
    },

    metadata: {

        render: function() {

            'use strict';

            accountUI.inputs.switch.init(
                '.dbDropOnLogout',
                $('.personal-data-container'),
                fmconfig.dbDropOnLogout,
                function(val) {
                    mega.config.setn('dbDropOnLogout', val);
                });

            // Initialise the Download personal data button on the /fm/account/security page
            gdprDownload.initDownloadDataButton('personal-data-container');
        }
    },

    session: {

        /**
         * Rendering session history table.
         * With session data from M.account.sessions, render table for session history
         */
        render: function() {

            "use strict";

            var $securitySection = $('.fm-account-security', accountUI.$contentBlock);
            var $sessionSelect = $('.dropdown-input.sessions', $securitySection);

            if (d) {
                console.log('Render session history');
            }

            if (!$.sessionlimit) {
                $.sessionlimit = 10;
            }

            $('span', $sessionSelect).text(mega.icu.format(l[472], $.sessionlimit));
            $('.session10-', $sessionSelect).text(mega.icu.format(l[472], 10));
            $('.session100-', $sessionSelect).text(mega.icu.format(l[472], 100));
            $('.session250-', $sessionSelect).text(mega.icu.format(l[472], 250));

            M.account.sessions.sort(function(a, b) {
                if (a[7] !== b[7]) {
                    return a[7] > b[7] ? -1 : 1;
                }
                if (a[5] !== b[5]) {
                    return a[5] > b[5] ? -1 : 1;
                }
                return a[0] < b[0] ? 1 : -1;
            });

            $('#sessions-table-container', $securitySection).empty();
            var html =
                '<table width="100%" border="0" cellspacing="0" cellpadding="0" class="data-table sessions">' +
                '<tr><th>' + l[19303] + '</th><th>' + l[480] + '</th><th>' + l[481] + '</th><th>' + l[482] + '</th>' +
                '<th class="no-border session-status">' + l[7664] + '</th>' +
                '<th class="no-border logout-column">&nbsp;</th></tr>';
            var numActiveSessions = 0;

            for (i = 0; i < M.account.sessions.length; i++) {
                var session = M.account.sessions[i];

                var currentSession = session[5];
                var activeSession = session[7];

                // If the current session or active then increment count
                if (currentSession || activeSession) {
                    numActiveSessions++;
                }

                if (i >= $.sessionlimit) {
                    continue;
                }

                html += this.getHtml(session);
            }

            $('#sessions-table-container', $securitySection).safeHTML(html + '</table>');

            // Don't show button to close other sessions if there's only the current session
            if (numActiveSessions === 1) {
                $('.fm-close-all-sessions', $securitySection).addClass('hidden');
            }
            else {
                $('.fm-close-all-sessions', $securitySection).removeClass('hidden');
            }
        },

        bindEvents: function() {

            'use strict';

            var $securitySection = $('.fm-account-security', accountUI.$contentBlock);
            var $sessionSelect = $('.dropdown-input.sessions', $securitySection);

            // Bind Dropdowns events
            bindDropdownEvents($sessionSelect);

            $('.fm-close-all-sessions', $securitySection).rebind('click.accountSection', function() {
                msgDialog('confirmation', '', l[18513], false, function(e) {
                    if (e) {
                        loadingDialog.show();
                        var $activeSessionsRows = $('.active-session-txt', $securitySection).parents('tr');
                        // Expire all sessions but not the current one
                        api.screq({a: 'usr', ko: 1})
                            .then(() => {
                                M.account = null;
                                /* clear account cache */
                                $('.settings-logout', $activeSessionsRows).remove();
                                $('.active-session-txt', $activeSessionsRows)
                                    .removeClass('active-session-txt').addClass('expired-session-txt').text(l[25016]);
                                $('.fm-close-all-sessions', $securitySection).addClass('hidden');
                                loadingDialog.hide();
                            });
                    }
                });
            });

            $('.settings-logout', $securitySection).rebind('click.accountSection', function() {

                var $this = $(this).parents('tr');
                var sessionId = $this.attr('class');

                if (sessionId === 'current') {
                    mLogout();
                }
                else {
                    loadingDialog.show();
                    /* usr - user session remove
                     * remove a session Id from the current user,
                     * usually other than the current session
                     */
                    api.screq({a: 'usr', s: [sessionId]})
                        .then(() => {
                            M.account = null;
                            /* clear account cache */
                            $this.find('.settings-logout').remove();
                            $this.find('.active-session-txt').removeClass('active-session-txt')
                                .addClass('expired-session-txt').text(l[25016]);
                            loadingDialog.hide();
                        });
                }
            });

            $('.mega-input-dropdown .option', $securitySection).rebind('click.accountSection', function() {

                var c = $(this).attr('class') ? $(this).attr('class') : '';

                if (c.indexOf('session10-') > -1) {
                    $.sessionlimit = 10;
                }
                else if (c.indexOf('session100-') > -1) {
                    $.sessionlimit = 100;
                }
                else if (c.indexOf('session250-') > -1) {
                    $.sessionlimit = 250;
                }

                accountUI();
            });
        },

        /**
         * Get html of one session data for session history table.
         * @param {Object} el a session data from M.account.sessions
         * @return {String} html
         * When draw session hitory table make html for each session data
         */
        getHtml: function(el) {

            "use strict";

            var currentSession = el[5];
            var activeSession = el[7];
            var userAgent = el[2];
            var dateTime = htmlentities(time2date(el[0]));
            var browser = browserdetails(userAgent);
            var browserName = browser.nameTrans;
            var ipAddress = htmlentities(el[3]);
            var country = countrydetails(el[4]);
            var sessionId = el[6];
            var status = '<span class="status-label green">' + l[7665] + '</span>';    // Current

            // Show if using an extension e.g. "Firefox on Linux (+Extension)"
            if (browser.isExtension) {
                browserName += ' (+' + l[7683] + ')';
            }

            // If not the current session
            if (!currentSession) {
                if (activeSession) {
                    status = '<span class="status-label blue">' + l[23754] + '</span>';     // Logged-in
                }
                else {
                    status = '<span class="status-label">' + l[25016] + '</span>';    // Expired
                }
            }

            // If unknown country code use question mark png
            if (!country.icon || country.icon === '??.png') {
                country.icon = 'ud.png';
            }

            // Generate row html
            var html = '<tr class="' + (currentSession ? "current" : sessionId) + '">'
                + '<td><div class="label-with-icon"><img title="'
                + escapeHTML(userAgent.replace(/\s*megext/i, ''))
                + '" src="' + staticpath + 'images/browser-icons/' + browser.icon
                + '" /><span title="' + htmlentities(browserName) + '">' + htmlentities(browserName)
                + '</span></div></td>'
                + '<td><span class="break-word" title="' + ipAddress + '">' + ipAddress + '</span></td>'
                + '<td><div class="label-with-icon"><img alt="" src="' + staticpath + 'images/flags/'
                + country.icon + '" title="' + htmlentities(country.name) + '" /><span>'
                + htmlentities(country.name) + '</span></div></td>'
                + '<td><span>' + dateTime + '</span></td>'
                + '<td>' + status + '</td>';

            // If the session is active show logout button
            if (activeSession) {
                html += '<td>'
                    + '<button class="mega-button small top-login-button settings-logout">'
                    + '<div><i class="sprite-fm-mono icon-logout"></i></div><span>' + l[967] + '</span>'
                    + '</button></td></tr>';
            }
            else {
                html += '<td>&nbsp;</td></tr>';
            }

            return html;
        },

        /**
         * Update Session History table html.
         * If there is any new session history found (or forced), re-render session history table.
         * @param {Boolean} force force update the table.
         */
        update: function(force) {

            "use strict";

            if (page === 'fm/account/security') {
                // if first item in sessions list is not match existing Dom list, it need update.
                if (d) {
                    console.log('Updating session history table');
                }

                M.refreshSessionList(function() {
                    var fSession = M.account.sessions[0];
                    var domList =  document.querySelectorAll('.data-table.sessions tr');

                    // update table when it has new active session or forced
                    if (fSession && (($(domList[1]).hasClass('current') && !fSession[5])
                        || !$(domList[1]).hasClass(fSession[6])) || force) {
                        if (d) {
                            console.log('Update session history table');
                        }
                        accountUI.security.session.render();
                        accountUI.security.session.bindEvents();
                    }
                });
            }
        }
    }
};

accountUI.fileManagement = {

    init: function(account) {

        'use strict';

        // File versioning
        this.versioning.render();
        this.versioning.bindEvents();

        // Rubbish cleaning schedule
        this.rubsched.render(account);
        this.rubsched.bindEvents(account);

        // User Interface
        this.userInterface.render();

        // Subfolder media discovery
        this.subfolderMediaDiscovery.render();

        // Hide Recents
        this.hideRecents.render();

        // Drag and Drop
        this.dragAndDrop.render();

        // Delete confirmation
        this.delConfirm.render();

        // Password reminder dialog
        this.passReminder.render();

        // Chat related dialogs (multiple option but share attribute)
        this.chatDialogs.render();

        // Pro expiry
        this.proExpiry.render();

        // Public Links
        this.publicLinks.render();
    },

    versioning: {

        render: function() {

            'use strict';

            // Temporarily hide versioning settings due to it not working correctly in MEGA Lite mode
            if (mega.lite.inLiteMode) {
                $('.js-file-version-settings', accountUI.$contentBlock).addClass('hidden');
                return false;
            }

            // Update versioning info
            var setVersioningAttr = function(val) {
                showToast('settings', l[16168]);
                val = val === 1 ? 0 : 1;
                mega.attr.set('dv', val, -2, true).done(function() {
                    fileversioning.dvState = val;
                });
            };

            fileversioning.updateVersionInfo();

            accountUI.inputs.switch.init(
                '#versioning-status',
                $('#versioning-status', accountUI.$contentBlock).parent(),
                !fileversioning.dvState,
                setVersioningAttr,
                function(val) {

                    var promise = new MegaPromise();

                    if (val) {
                        msgDialog('confirmation', l[882], l[17595], false, function(e) {

                            if (e) {
                                promise.resolve();
                            }
                            else {
                                promise.reject();
                            }
                        });
                    }
                    else {
                        promise.resolve();
                    }
                    return promise;
                });
        },

        bindEvents: function() {

            'use strict';

            $('#delete-all-versions', accountUI.$contentBlock).rebind('click', function() {

                if ($(this).hasClass('disabled') || M.isInvalidUserStatus()) {
                    return;
                }

                msgDialog('remove', l[1003], l[17581], l[1007], (e) => {

                    if (e) {
                        mLoadingSpinner.show('delete-all-versions', l[17147]);

                        api.screq({a: 'dv'})
                            .then(() => {
                                M.accountData(() => fileversioning.updateVersionInfo(), false, true);
                            })
                            .catch(dump)
                            .finally(() => {
                                mLoadingSpinner.hide('delete-all-versions');
                            });
                    }
                });
            });
        }
    },

    rubsched: {

        render: function(account) {

            'use strict';

            if (d) {
                console.log('Render rubbish bin schedule');
            }

            var $rubschedParent = $('#rubsched', accountUI.$contentBlock).parent();
            var $rubschedGreenNoti = $('.rub-grn-noti', accountUI.$contentBlock);
            var $rubschedOptions = $('.rubsched-options', accountUI.$contentBlock);

            var initRubschedSwitch = function(defaultValue) {
                accountUI.inputs.switch.init(
                    '#rubsched',
                    $('#rubsched', accountUI.$contentBlock).parent(),
                    defaultValue,
                    function(val) {
                        if (val) {
                            $('#rubsched', accountUI.$contentBlock).closest('.slide-in-out').removeClass('closed');
                            $rubschedParent.addClass('border');

                            if (!fmconfig.rubsched) {
                                var defValue = u_attr.p ? 90 : 30;
                                var defOption = 14;
                                mega.config.setn('rubsched', defOption + ":" + defValue);
                                $('#rad' + defOption + '_opt', accountUI.$contentBlock).val(defValue);
                            }
                        }
                        else {
                            mega.config.setn('rubsched', 0);
                            $('#rubsched', accountUI.$contentBlock).closest('.slide-in-out').addClass('closed');
                            $rubschedParent.removeClass('border');
                        }
                    });
            };

            if (u_attr.flags.ssrs > 0) { // Server side scheduler - new
                $rubschedOptions.removeClass('hidden');
                $('.rubschedopt', accountUI.$contentBlock).addClass('hidden');
                $('.rubschedopt-none', accountUI.$contentBlock).addClass('hidden');

                var value = account.ssrs ? account.ssrs : (u_attr.p ? 90 : 30);

                var rad14_optString = mega.icu.format(l.clear_rub_bin_days, value);
                var rad14_optArray = rad14_optString.split(/\[A]|\[\/A]/);

                $('#rad14_opt', accountUI.$contentBlock).val(rad14_optArray[1]);
                $('#rad14_opt_txt_1', accountUI.$contentBlock).text(rad14_optArray[0]);
                $('#rad14_opt_txt_2', accountUI.$contentBlock).text(rad14_optArray[2]);

                if (!value) {
                    $rubschedOptions.addClass('hidden');
                }

                // show/hide on/off switches
                if (u_attr.p) {
                    $rubschedParent.removeClass('hidden');
                    $rubschedGreenNoti.addClass('hidden');
                    $('.rubbish-desc', accountUI.$contentBlock).text(l[18685]).removeClass('hidden');
                    $('.account.rubbish-cleaning .settings-right-block', accountUI.$contentBlock)
                        .addClass('slide-in-out');

                    if (account.ssrs) {
                        $rubschedParent.addClass('border').parent().removeClass('closed');
                    }
                    else {
                        $rubschedParent.removeClass('border').parent().addClass('closed');
                    }

                    initRubschedSwitch(account.ssrs);
                }
                else {
                    $rubschedParent.addClass('hidden');
                    $rubschedGreenNoti.removeClass('hidden');
                    $('.rubbish-desc', accountUI.$contentBlock).text(l[18686]).removeClass('hidden');
                    $('.account.rubbish-cleaning .settings-right-block', accountUI.$contentBlock)
                        .removeClass('slide-in-out');
                }
            }
            else { // Client side scheduler - old
                initRubschedSwitch(fmconfig.rubsched);

                if (u_attr.p) {
                    $rubschedGreenNoti.addClass('hidden');
                }
                else {
                    $rubschedGreenNoti.removeClass('hidden');
                }

                if (fmconfig.rubsched) {
                    $rubschedParent.addClass('border').parent().removeClass('closed');
                    $rubschedOptions.removeClass('hidden');
                    $('.rubschedopt', accountUI.$contentBlock).removeClass('hidden');

                    var opt = String(fmconfig.rubsched).split(':');
                    $('#rad' + opt[0] + '_opt', accountUI.$contentBlock).val(opt[1]);

                    accountUI.inputs.radio.init(
                        '.rubschedopt',
                        $('.rubschedopt', accountUI.$contentBlock).parent(),
                        opt[0],
                        function (val) {
                            mega.config.setn('rubsched', val + ":" + $('#rad' + val + '_opt').val());
                        }
                    );
                }
                else {
                    $rubschedParent.removeClass('border').parent().addClass('closed');
                }
            }
        },
        bindEvents: function() {

            'use strict';

            $('.rubsched_textopt', accountUI.$contentBlock).rebind('click.rs blur.rs keypress.rs', function(e) {

                // Do not save value until user leave input or click Enter button
                if (e.which && e.which !== 13) {
                    return;
                }

                var curVal = parseInt($(this).val()) | 0;
                var maxVal;

                if (this.id === 'rad14_opt') { // For days option
                    var minVal = 7;
                    maxVal = u_attr.p ? Math.pow(2, 53) : 30;
                    curVal = Math.min(Math.max(curVal, minVal), maxVal);
                    var rad14_optString = mega.icu.format(l.clear_rub_bin_days, curVal);
                    var rad14_optArray = rad14_optString.split(/\[A]|\[\/A]/);
                    curVal = rad14_optArray[1];
                    $('#rad14_opt_txt_1', accountUI.$contentBlock).text(rad14_optArray[0]);
                    $('#rad14_opt_txt_2', accountUI.$contentBlock).text(rad14_optArray[2]);
                }

                if (this.id === 'rad15_opt') { // For size option
                    // Max value cannot be over current account's total storage space.
                    maxVal = account.space / Math.pow(1024, 3);
                    curVal = Math.min(curVal, maxVal);
                }

                $(this).val(curVal);

                var id = String(this.id).split('_')[0];
                mega.config.setn('rubsched', id.substr(3) + ':' + curVal);
            });
        }
    },

    userInterface: {

        _initOption: function(name) {
            'use strict';
            var selector = '.' + name;

            accountUI.inputs.radio.init(selector, $(selector).parent(), fmconfig[name] | 0,
                function(val) {
                    mega.config.setn(name, parseInt(val) | 0, l[16168]);
                }
            );
        },

        render: function() {
            'use strict';

            this._initOption('uisorting');
            this._initOption('uiviewmode');
        }
    },

    subfolderMediaDiscovery: {
        render: function() {
            'use strict';

            accountUI.inputs.switch.init(
                '#subfolder-media-discovery',
                $('#subfolder-media-discovery', accountUI.$contentBlock).parent(),
                !mega.config.get('noSubfolderMd'),
                (val) => {
                    mega.config.setn('noSubfolderMd', val ? undefined : 1);
                }
            );
        }
    },

    hideRecents: {
        render: function() {
            'use strict';

            accountUI.inputs.switch.init(
                '#hide-recents',
                $('#hide-recents', accountUI.$contentBlock).parent(),
                !mega.config.get('showRecents'),
                (val) => {
                    val = val ? undefined : 1;

                    if (M.recentsRender) {
                        showToast('settings', l[16168]);
                        M.recentsRender._setConfigShow(val);
                    }
                    else {
                        mega.config.setn('showRecents', val);
                    }
                });
        }
    },

    dragAndDrop: {

        render: function() {
            'use strict';

            accountUI.inputs.switch.init(
                '#ulddd',
                $('#ulddd', accountUI.$contentBlock).parent(),
                !mega.config.get('ulddd'),
                function(val) {
                    mega.config.setn('ulddd', val ? undefined : 1);
                });
        }
    },

    delConfirm: {

        render: function() {
            'use strict';

            accountUI.inputs.switch.init(
                '#skipDelWarning',
                $('#skipDelWarning', accountUI.$contentBlock).parent(),
                !mega.config.get('skipDelWarning'),
                val => mega.config.setn('skipDelWarning', val ? undefined : 1)
            );
        }
    },

    passReminder: {

        render: function() {
            'use strict';

            accountUI.inputs.switch.init(
                '#prd',
                $('#prd', accountUI.$contentBlock).parent(),
                !mega.ui.passwordReminderDialog.passwordReminderAttribute.dontShowAgain,
                val => {
                    mega.ui.passwordReminderDialog.passwordReminderAttribute.dontShowAgain = val ^ 1;
                    showToast('settings', l[16168]);
                });
        }
    },

    chatDialogs: {

        render: function() {
            'use strict';

            const $switches = $('.dialog-options .chat-dialog', accountUI.$contentBlock);
            const rawVal = mega.config.get('xcod');
            const _set = (id, val, subtype) => {

                if (val) {
                    mega.config.setn('xcod', mega.config.get(id) & ~(1 << subtype));
                }
                else {
                    mega.config.setn('xcod', mega.config.get(id) | 1 << subtype);
                }
            };

            for (let i = $switches.length; i--;) {

                const elm = $switches[i];
                const [id, subtype] = elm.id.split('-');
                const currVal = rawVal >> subtype & 1;

                accountUI.inputs.switch.init(
                    '.mega-switch',
                    $(elm).parent(),
                    !currVal,
                    val => _set(id, val, subtype)
                );
            }
        }
    },

    proExpiry: {

        render: async function() {
            'use strict';

            accountUI.inputs.switch.init(
                '#hideProExpired',
                $('#hideProExpired', accountUI.$contentBlock).parent(),
                (await Promise.resolve(mega.attr.get(u_handle, 'hideProExpired', false, true)).catch(() => []))[0] ^ 1,
                val => {
                    mega.attr.set('hideProExpired', val ? '0' : '1', false, true);
                    showToast('settings', l[16168]);
                });
        }
    },

    publicLinks: {
        render: function() {
            'use strict';

            var warnplinkId = '#nowarnpl';

            accountUI.inputs.switch.init(
                warnplinkId,
                $(warnplinkId, accountUI.$contentBlock).parent(),
                !mega.config.get('nowarnpl'),
                val => mega.config.setn('nowarnpl', val ^ 1)
            );
        }
    },
};

accountUI.transfers = {

    init: function(account) {

        'use strict';

        this.$page = $('.fm-account-sections.fm-account-transfers', accountUI.$contentBlock);

        // Upload and Download - Bandwidth
        this.uploadAndDownload.bandwidth.render(account);

        // Upload and Download - Upload
        this.uploadAndDownload.upload.render();

        // Upload and Download - Download
        this.uploadAndDownload.download.render();

        // Transfer Tools - Megasync
        this.transferTools.megasync.render();
    },

    uploadAndDownload: {

        setSlider($container, sliderSelector, sliderOptions) {
            'use strict';

            const wrap = $('.slider.numbers-wrap', $container).get(0);
            const template = wrap.firstElementChild.cloneNode(true);

            wrap.textContent = '';
            for (let i = 0; i < sliderOptions.max;) {
                const elm = template.cloneNode(true);
                wrap.appendChild(elm);
                elm.querySelector('span').textContent = ++i;
            }

            const $slider = $(sliderSelector, $container).slider(sliderOptions);

            $('.ui-slider-handle', $slider)
                .addClass('sprite-fm-mono icon-arrow-left sprite-fm-mono-after icon-arrow-right-after');

            $('.numbers.active', $container).removeClass('active');
            $(`.numbers:nth-child(${$slider.slider('value')})`, $container).addClass('active');

            return $slider;
        },

        bandwidth: {

            render: function(account) {

                'use strict';

                // LITE/PRO account
                if (u_attr.p && !u_attr.b && !u_attr.pf) {
                    var bandwidthLimit = Math.round(account.servbw_limit | 0);

                    var $slider = $('#bandwidth-slider').slider({
                        min: 0, max: 100, range: 'min', value: bandwidthLimit,
                        change: function(e, ui) {
                            if (M.currentdirid === 'account/transfers') {
                                bandwidthLimit = ui.value;

                                if (parseInt($.bandwidthLimit) !== bandwidthLimit) {

                                    var done = delay.bind(null, 'bandwidthLimit', function() {
                                        api_req({"a": "up", "srvratio": Math.round(bandwidthLimit)});
                                        if ($.bandwidthLimit !== undefined) {
                                            showToast('settings', l[16168]);
                                        }
                                        $.bandwidthLimit = bandwidthLimit;
                                    }, 700);

                                    if (bandwidthLimit > 99) {
                                        msgDialog('warningb:!' + l[776], l[882], l[12689], 0, function(e) {
                                            if (e) {
                                                done();
                                            }
                                            else {
                                                $('.slider-percentage')
                                                    .safeHTML(l.transfer_quota_pct.replace('%1', formatPercentage(0)));
                                                $('.slider-percentage span').removeClass('bold warn');
                                                $('#bandwidth-slider').slider('value', 0);
                                            }
                                        });
                                    }
                                    else {
                                        done();
                                    }
                                }
                            }
                        },
                        slide: function(e, ui) {
                            $('.slider-percentage', accountUI.$contentBlock)
                                .safeHTML(l.transfer_quota_pct.replace('%1', formatPercentage(ui.value / 100)));

                            if (ui.value > 90) {
                                $('.slider-percentage span', accountUI.$contentBlock).addClass('warn bold');
                            }
                            else {
                                $('.slider-percentage span', accountUI.$contentBlock).removeClass('bold warn');
                            }
                        }
                    });

                    $('.ui-slider-handle', $slider).addClass('sprite-fm-mono icon-arrow-left ' +
                        'sprite-fm-mono-after icon-arrow-right-after');

                    $('.slider-percentage', accountUI.$contentBlock)
                        .safeHTML(l.transfer_quota_pct.replace('%1', formatPercentage(bandwidthLimit / 100)));
                    $('.bandwith-settings', accountUI.$contentBlock).removeClass('disabled').addClass('border');
                    $('.slider-percentage-bl', accountUI.$contentBlock).removeClass('hidden');
                    $('.band-grn-noti', accountUI.$contentBlock).addClass('hidden');
                }
                // Business account or Pro Flexi
                else if (u_attr.b || u_attr.pf) {
                    $('.bandwith-settings', accountUI.$contentBlock).addClass('hidden');
                    $('.slider-percentage-bl', accountUI.$contentBlock).addClass('hidden');
                    $('.band-grn-noti', accountUI.$contentBlock).addClass('hidden');
                }
            }
        },

        upload: {

            render: function() {
                'use strict';

                var $uploadSettings = $('.upload-settings', accountUI.$contentBlock);

                accountUI.transfers.uploadAndDownload.setSlider($uploadSettings, '#slider-range-max', {
                    min: 1, max: 8, range: "min", value: fmconfig.ul_maxSlots || 4,
                    change: function(e, ui) {
                        if (M.currentdirid === 'account/transfers' && ui.value !== fmconfig.ul_maxSlots) {
                            mega.config.setn('ul_maxSlots', ui.value);
                            ulQueue.setSize(fmconfig.ul_maxSlots);
                        }
                    },
                    slide: function(e, ui) {
                        $('.numbers.active', $uploadSettings).removeClass('active');
                        $('.numbers:nth-child(' + ui.value + ')', $uploadSettings)
                            .addClass('active');
                    }
                });
            },
        },

        download: {

            render: function() {

                'use strict';

                var $downloadSettings = $('.download-settings', accountUI.$contentBlock);

                accountUI.transfers.uploadAndDownload.setSlider($downloadSettings, '#slider-range-max2', {
                    min: 1, max: 12, range: "min", value: fmconfig.dl_maxSlots || 4,
                    change: function(e, ui) {
                        if (M.currentdirid === 'account/transfers' && ui.value !== fmconfig.dl_maxSlots) {
                            mega.config.setn('dl_maxSlots', ui.value);
                            dlQueue.setSize(fmconfig.dl_maxSlots);
                        }
                    },
                    slide: function(e, ui) {
                        $('.numbers.active', $downloadSettings).removeClass('active');
                        $('.numbers:nth-child(' + ui.value + ')', $downloadSettings)
                            .addClass('active');
                    }
                });
            }
        }
    },

    transferTools: {

        megasync: {

            render : function() {

                'use strict';

                var $section = $('.transfer-tools', accountUI.transfers.$page);

                accountUI.inputs.switch.init(
                    '#dlThroughMEGAsync',
                    $('#dlThroughMEGAsync', accountUI.$contentBlock).parent(),
                    fmconfig.dlThroughMEGAsync,
                    function(val) {
                        mega.config.setn('dlThroughMEGAsync', val);
                        if (val) {
                            megasync.periodicCheck();
                        }
                        else {
                            window.useMegaSync = 4;
                        }
                    });

                megasync.isInstalled((err, is) => {

                    if (!err && is) {
                        $('.mega-banner', $section).addClass('hidden');
                    }
                    else {
                        $('.mega-banner', $section).removeClass('hidden');
                    }
                });
            }
        }
    }
};

accountUI.contactAndChat = {

    init: function(autoaway, autoawaylock, autoawaytimeout, persist, persistlock, lastSeen) {
        'use strict';
        if (window.megaChatIsDisabled) {
            console.error('Mega Chat is disabled, cannot proceed to Contact and Chat settings');
            return;
        }

        var self = this;

        if (!megaChatIsReady) {
            // If chat is not ready waiting for chat_initialized broadcaster.
            loadingDialog.show();
            var args = toArray.apply(null, arguments);
            mBroadcaster.once('chat_initialized', function() {
                self.init.apply(self, args);
            });
            return true;
        }
        loadingDialog.hide();

        var presenceInt = megaChat.plugins.presencedIntegration;

        if (!presenceInt || !presenceInt.userPresence) {
            setTimeout(function() {
                throw new Error('presenceInt is not ready...');
            });
            return true;
        }

        presenceInt.rebind('settingsUIUpdated.settings', function() {
            self.init.apply(self, toArray.apply(null, arguments).slice(1));
        });

        // Only call this if the call of this function is the first one, made by fm.js -> accountUI
        if (autoaway === undefined) {
            presenceInt.userPresence.updateui();
            return true;
        }

        this.status.render(presenceInt, autoaway, autoawaylock, autoawaytimeout, persist, persistlock, lastSeen);
        this.status.bindEvents(presenceInt, autoawaytimeout);
        this.chatList.render();
        this.richURL.render();
        this.dnd.render();
        this.contactVerification.render();
    },

    status: {

        AWAY_REFS: {
            hours: 'autoaway-hours',
            minutes: 'autoaway-minutes'
        },

        render: function(presenceInt, autoaway, autoawaylock, autoawaytimeout, persist, persistlock, lastSeen) {

            'use strict';

            // Chat
            var $sectionContainerChat = $('.fm-account-contact-chats', accountUI.$contentBlock);

            // Status appearance radio buttons
            accountUI.inputs.radio.init(
                '.chatstatus',
                $('.chatstatus').parent(),
                presenceInt.getPresence(u_handle),
                function(newVal) {
                    presenceInt.setPresence(parseInt(newVal));
                    showToast('settings', l[16168]);
                });

            // Last seen switch
            accountUI.inputs.switch.init(
                '#last-seen',
                $sectionContainerChat,
                lastSeen,
                function(val) {
                    presenceInt.userPresence.ui_enableLastSeen(Boolean(val));
                    showToast('settings', l[16168]);
                });

            if (autoawaytimeout !== false) {
                // Auto-away switch
                accountUI.inputs.switch.init(
                    '#auto-away-switch',
                    $sectionContainerChat,
                    autoaway,
                    function(val) {
                        presenceInt.userPresence.ui_setautoaway(Boolean(val));
                        showToast('settings', l[16168]);
                    });

                // Prevent changes to autoaway if autoawaylock is set
                if (autoawaylock === true) {
                    $('#auto-away-switch', $sectionContainerChat).addClass('disabled')
                        .parent().addClass('hidden');
                }
                else {
                    $('#auto-away-switch', $sectionContainerChat).removeClass('disabled')
                        .parent().removeClass('hidden');
                }

                // Auto-away input box
                const [hours, minutes] = [Math.floor(autoawaytimeout / 3600), autoawaytimeout % 3600 / 60];
                const strArray = l.set_autoaway.split('[X]');

                $('#autoaway_txt_1', $sectionContainerChat).text(strArray[0]); // `Set status to Away after`
                $(`input#${this.AWAY_REFS.hours}`, $sectionContainerChat).val(hours || '');
                $('#autoaway_txt_2', $sectionContainerChat).text(mega.icu.format(l.plural_hour, hours));
                $(`input#${this.AWAY_REFS.minutes}`, $sectionContainerChat).val(minutes || '');
                $('#autoaway_txt_3', $sectionContainerChat).text(mega.icu.format(l.plural_minute, minutes));
                $('#autoaway_txt_4', $sectionContainerChat).text(strArray[1]); // `of inactivity.`

                // Always editable for user comfort -
                accountUI.controls.enableElement(
                    $(`input#${this.AWAY_REFS.hours}, input#${this.AWAY_REFS.minutes}`, $sectionContainerChat)
                );

                // Persist switch
                accountUI.inputs.switch.init(
                    '#persist-presence-switch',
                    $sectionContainerChat,
                    persist,
                    function(val) {
                        presenceInt.userPresence.ui_setpersist(Boolean(val));
                        showToast('settings', l[16168]);
                    });

                // Prevent changes to autoaway if autoawaylock is set
                if (persistlock === true) {
                    $('#persist-presence-switch', $sectionContainerChat).addClass('disabled')
                        .parent().addClass('hidden');
                }
                else {
                    $('#persist-presence-switch', $sectionContainerChat).removeClass('disabled')
                        .parent().removeClass('hidden');
                }
            }
        },

        bindEvents: function(presenceInt, autoawaytimeout) {
            'use strict';
            if (autoawaytimeout !== false) {
                const { AWAY_REFS } = this;
                $(`input#${Object.values(AWAY_REFS).join(', input#')}`).rebind('change.dashboard', () =>
                    presenceInt.userPresence.ui_setautoaway(
                        true,
                        Object.values(AWAY_REFS)
                            .map(ref => {
                                const el = document.getElementById(ref);
                                let [value, max] = (({ value, max }) => [Math.max(0, value | 0), max | 0])(el);

                                if (value > max) {
                                    el.value = value = max;
                                }

                                // hours || minutes -> seconds
                                return el.id === AWAY_REFS.hours ? value * 3600 : value * 60;
                            })
                            // hours + minutes -> seconds || default to 300 seconds as min
                            .reduce((a, b) => a + b) || 300
                    )
                );
            }
        },
    },

    chatList: {

        render: function() {
            'use strict';
            const curr = mega.config.get('showHideChat') | 0;

            accountUI.inputs.radioCard.init(
                '.card',
                $('.card', accountUI.$contentBlock).parent(),
                curr,
                (val) => {
                    mega.config.setn('showHideChat', val | 0 || undefined);
                }
            );
        }
    },

    richURL: {

        render: function() {

            'use strict';

            if (typeof RichpreviewsFilter === 'undefined') {
                return;
            }

            // Auto-away switch
            const { previewGenerationConfirmation, confirmationDoConfirm, confirmationDoNever } = RichpreviewsFilter;
            accountUI.inputs.switch.init(
                '#richpreviews',
                $('#richpreviews').parent(),
                // previewGenerationConfirmation -> -1 (unset, default) || true || false
                previewGenerationConfirmation && previewGenerationConfirmation > 0,
                val => {
                    if (val){
                        confirmationDoConfirm();
                    }
                    else {
                        confirmationDoNever();
                    }
                    showToast('settings', l[16168]);
                }
            );
        }
    },

    dnd: {

        /**
         * Cached references for common DOM elements
         */

        DOM: {
            container: '.fm-account-main',
            toggle: '#push-settings-toggle',
            dialog: '.push-settings-dialog',
            status: '.push-settings-status',
        },

        /**
         * @see PushNotificationSettings.GROUPS
         */

        group: 'CHAT',

        /**
         * hasDnd
         * @description Get the current push notification setting
         * @returns {Boolean}
         */

        hasDnd: function() {
            'use strict';
            return (
                pushNotificationSettings &&
                pushNotificationSettings.getDnd(this.group) ||
                pushNotificationSettings.getDnd(this.group) === 0
            );
        },

        /**
         * getTimeString
         * @description Returns human readable and formatted string based on the
         * current push notification setting (timestamp)
         * @example `Notification will be silent until XX:XX`
         * @returns {String}
         */

        getTimeString: function() {
            'use strict';
            var dnd = pushNotificationSettings.getDnd(this.group);
            if (dnd) {
                return (
                    // `Notifications will be silent until %s`
                    l[23540].replace('%s', '<span>' + toLocaleTime(dnd) + '</span>')
                );
            }
            return '&nbsp;';
        },

        /**
         * renderStatus
         * @param hasDnd Boolean the push notification setting status
         * @returns {*}
         */

        renderStatus: function(hasDnd) {
            'use strict';
            var $status = $(this.DOM.status, this.DOM.container);
            return hasDnd ? $status.safeHTML(this.getTimeString()).removeClass('hidden') : $status.addClass('hidden');
        },

        /**
         * setInitialState
         * @description Invoked immediately upon loading the module, sets the initial state -- conditionally
         * sets the toggle state, renders formatted timestamp
         */

        setInitialState: function() {
            'use strict';
            if (this.hasDnd()) {
                var dnd = pushNotificationSettings.getDnd(this.group);
                if (dnd && dnd < unixtime()) {
                    pushNotificationSettings.disableDnd(this.group);
                    return;
                }
                $(this.DOM.toggle, this.DOM.container).addClass('toggle-on').trigger('update.accessibility');
                this.renderStatus(true);
            }
        },

        /**
         * setMorningOption
         * @description Handles the `Until tomorrow morning, 08:00` / `Until this morning, 08:00` option.
         */

        setMorningOption: function() {
            'use strict';
            var container = '.radio-txt.morning-option';
            var $label = $('span', container);
            var $radio = $('input', container);

            // 00:01 ~ 07:59 -> `Until this morning, 08:00`
            // 08:00 ~ 00:00 -> `Until tomorrow morning, 08:00`
            var targetTomorrow = (new Date().getHours()) >= 8;

            var date = new Date();
            // Start of the day -> 08:00
            date.setHours(0, 1, 0, 0);
            date.setHours(date.getHours() + 8);
            if (targetTomorrow) {
                // +1 day if we target `tomorrow morning`
                date.setDate(date.getDate() + 1);
            }
            var difference = Math.abs(date - new Date());
            var minutesUntil = Math.floor(difference / 1000 / 60);

            $label.safeHTML(
                targetTomorrow ? l[23671] || 'Until tomorrow morning, 08:00' : l[23670] || 'Until this morning, 08:00'
            );
            $radio.val(minutesUntil);
        },

        /**
         * handleToggle
         * @description Handles the toggle switch -- conditionally adds or removes the toggle active state,
         * disables or sets the `Until I Turn It On Again` default setting
         * @param ev Object the event object
         */

        handleToggle: function(ev) {
            'use strict';

            var hasDnd = this.hasDnd();
            var group = this.group;

            if (hasDnd) {
                pushNotificationSettings.disableDnd(group);
                this.renderStatus(false);
                $(ev.currentTarget).removeClass('toggle-on').trigger('update.accessibility');
                showToast('settings', l[16168]);
            }
            else {
                this.handleDialogOpen();
            }
        },

        /**
         * handleDialogOpen
         * @description
         * Handles the dialog toggle, incl. attaches additional handler that sets the given setting if any is selected
         */

        handleDialogOpen: function() {
            'use strict';

            var self = this;
            var $dialog = $(this.DOM.dialog);
            var time = unixtime();

            this.setMorningOption();
            M.safeShowDialog('push-settings-dialog', $dialog);

            // Init radio button UI.
            accountUI.inputs.radio.init('.custom-radio', $dialog, '');

            // Bind the `Done` specific event handling
            $('.push-settings-done', $dialog).rebind('click.dndUpdate', function() {
                var $radio = $('input[type="radio"]:checked', $dialog);
                var value = parseInt($radio.val(), 10);

                pushNotificationSettings.setDnd(self.group, value === 0 ? 0 : time + value * 60);
                $(self.DOM.toggle, self.DOM.container).addClass('toggle-on').trigger('update.accessibility');
                closeDialog();
                self.renderStatus(true);
                showToast('settings', l[16168]);
            });
        },

        /**
         * bindEvents
         * @description
         * Bind the initial event handlers, excl. the `Done` found within the dialog
         */

        bindEvents: function() {
            'use strict';
            $(this.DOM.toggle, this.DOM.container).rebind('click.dndToggleSwitch', this.handleToggle.bind(this));
            $('button.js-close, .push-settings-close', this.DOM.dialog).rebind('click.dndDialogClose', closeDialog);
        },

        /**
         * render
         * @description
         * Initial render, invoked upon mounting the module
         */

        render: function() {
            'use strict';
            this.setInitialState();
            this.bindEvents();
        }
    },

    delayRender: function(presenceInt, autoaway) {

        'use strict';

        var self = this;

        if (!megaChatIsReady) {
            if (megaChatIsDisabled) {
                console.error('Mega Chat is disabled, cannot proceed to Contact and Chat settings');
            }
            else {
                // If chat is not ready waiting for chat_initialized broadcaster.
                loadingDialog.show();
                mBroadcaster.once('chat_initialized', self.delayRender.bind(self, presenceInt, autoaway));
            }
            return true;
        }
        loadingDialog.hide();

        if (!presenceInt || !presenceInt.userPresence) {
            setTimeout(function() {
                throw new Error('presenceInt is not ready...');
            });
            return true;
            // ^ FIXME too..!
        }

        // Only call this if the call of this function is the first one, made by fm.js -> accountUI
        if (autoaway === undefined) {
            presenceInt.rebind('settingsUIUpdated.settings', function(
                e,
                autoaway,
                autoawaylock,
                autoawaytimeout,
                persist,
                persistlock,
                lastSeen
            ) {
                self.init(autoaway, autoawaylock, autoawaytimeout, persist, persistlock, lastSeen);
            });

            presenceInt.userPresence.updateui();
            return true;
        }

        if (typeof (megaChat) !== 'undefined' && typeof(presenceInt) !== 'undefined') {
            presenceInt.rebind('settingsUIUpdated.settings', function(
                e,
                autoaway,
                autoawaylock,
                autoawaytimeout,
                persist,
                persistlock,
                lastSeen
            ) {
                self.init(autoaway, autoawaylock, autoawaytimeout, persist, persistlock, lastSeen);
            });
        }
    },

    contactVerification: {

        render: function() {

            'use strict';

            const cv = mega.keyMgr.getWarningValue('cv') | 0;
            const $sectionContainerChat = $('.fm-account-contact-chats', accountUI.$contentBlock);

            accountUI.inputs.switch.init(
                '#contact-verification-toggle',
                $('#contact-verification-toggle', $sectionContainerChat).parent(),
                cv,
                val => {
                    mega.keyMgr.setWarningValue('cv', !!val).catch(dump);
                    showToast('settings', l[16168]);
                }
            );
        }
    }
};

accountUI.reseller = {

    init: function(account) {

        'use strict';

        if (M.account.reseller) {
            this.voucher.render(account);
            this.voucher.bindEvents();
        }
    },

    voucher: {

        render: function(account) {

            'use strict';

            var $resellerSection = $('.fm-account-reseller', accountUI.$contentBlock);
            var $vouchersSelect = $('.dropdown-input.vouchers',  $resellerSection);

            if (!$.voucherlimit) {
                $.voucherlimit = 10;
            }

            var email = 'resellers@mega.nz';

            $('.resellerbuy').attr('href', 'mailto:' + email)
                .find('span').text(l[9106].replace('%1', email));

            // Use 'All' or 'Last 10/100/250' for the dropdown text
            const buttonText = $.voucherlimit === 'all' ? l[7557] : mega.icu.format(l[466], $.voucherlimit);

            $('span', $vouchersSelect).text(buttonText);
            $('.balance span', $resellerSection).safeHTML('@@ &euro; ', account.balance[0][0]);
            $('.voucher10-', $vouchersSelect).text(mega.icu.format(l[466], 10));
            $('.voucher100-', $vouchersSelect).text(mega.icu.format(l[466], 100));
            $('.voucher250-', $vouchersSelect).text(mega.icu.format(l[466], 250));

            // Sort vouchers by most recently created at the top
            M.account.vouchers.sort(function(a, b) {

                if (a['date'] < b['date']) {
                    return 1;
                }
                else {
                    return -1;
                }
            });

            $('.data-table.vouchers tr', $resellerSection).remove();

            var html = '<tr><th>' + l[475] + '</th><th>' + l[7714] + '</th><th>' + l[477]
                + '</th><th>' + l[488] + '</th></tr>';

            $(account.vouchers).each(function(i, el) {

                // Only show the last 10, 100, 250 or if the limit is not set show all vouchers
                if (($.voucherlimit !== 'all') && (i >= $.voucherlimit)) {
                    return false;
                }

                var status = l[489];
                if (el.redeemed > 0 && el.cancelled === 0 && el.revoked === 0) {
                    status = l[490] + ' ' + time2date(el.redeemed);
                }
                else if (el.revoked > 0 && el.cancelled > 0) {
                    status = l[491] + ' ' + time2date(el.revoked);
                }
                else if (el.cancelled > 0) {
                    status = l[492] + ' ' + time2date(el.cancelled);
                }

                var voucherLink = 'https://127.0.0.1/#voucher' + htmlentities(el.code);

                html += '<tr><td><span>' + time2date(el.date) + '</span></td>'
                    + '<td class="selectable"><span class="break-word">' + voucherLink + '</span></td>'
                    + '<td><span>&euro; ' + htmlentities(el.amount) + '</span></td>'
                    + '<td><span>' + status + '</span></td></tr>';
            });

            $('.data-table.vouchers', $resellerSection).safeHTML(html);
            $('.vouchertype .dropdown-scroll', $resellerSection).text('');
            $('.vouchertype > span', $resellerSection).text(l[6875]);

            var prices = [];
            for (var i = 0; i < M.account.prices.length; i++) {
                if (M.account.prices[i]) {
                    prices.push(M.account.prices[i][0]);
                }
            }
            prices.sort(function(a, b) {
                return (a - b);
            });

            var voucheroptions = '';
            for (var j = 0; j < prices.length; j++) {
                voucheroptions += '<div class="option" data-value="'
                    + htmlentities(prices[j])
                    + '">&euro;' + htmlentities(prices[j]) + ' voucher</div>';
            }
            $('.vouchertype .dropdown-scroll', $resellerSection)
                .safeHTML(voucheroptions);
        },

        bindEvents: function() {

            'use strict';

            var $resellerSection = $('.fm-account-reseller', accountUI.$contentBlock);
            var $voucherSelect = $('.vouchers.dropdown-input', $resellerSection);
            var $voucherTypeSelect = $('.vouchertype.dropdown-input', $resellerSection);

            // Bind Dropdowns events
            bindDropdownEvents($voucherSelect);
            bindDropdownEvents($voucherTypeSelect);

            $('.vouchercreate', $resellerSection).rebind('click.voucherCreateClick', function() {
                var vouchertype = $('.option[data-state="active"]', $voucherTypeSelect)
                    .attr('data-value');
                var voucheramount = parseInt($('#account-voucheramount', $resellerSection).val());
                var proceed = false;

                for (var i in M.account.prices) {
                    if (M.account.prices[i][0] === vouchertype) {
                        proceed = true;
                    }
                }
                if (!proceed) {
                    msgDialog('warninga', l[135], 'Please select the voucher type.');
                    return false;
                }
                if (!voucheramount) {
                    msgDialog('warninga', l[135], 'Please enter a valid voucher amount.');
                    return false;
                }
                if (vouchertype === '19.99') {
                    vouchertype = '19.991';
                }
                loadingDialog.show();
                api_req({a: 'uavi', d: vouchertype, n: voucheramount, c: 'EUR'},
                    {
                        callback: function() {
                            M.account.lastupdate = 0;
                            accountUI();
                        }
                    });
            });

            $('.option', $voucherSelect).rebind('click.accountSection', function() {
                var $this = $(this);

                var c = $this.attr('class') ? $this.attr('class') : '';

                if (c.indexOf('voucher10-') > -1) {
                    $.voucherlimit = 10;
                }
                else if (c.indexOf('voucher100-') > -1) {
                    $.voucherlimit = 100;
                }
                else if (c.indexOf('voucher250-') > -1) {
                    $.voucherlimit = 250;
                }
                else if (c.indexOf('voucherAll-') > -1) {
                    $.voucherlimit = 'all';
                }

                accountUI();
            });
        }
    }
};

accountUI.calls = {
    init: function() {
        'use strict';
        this.emptyGroupCall.render();
        this.callNotifications.render();
    },
    emptyGroupCall: {
        render: function() {
            'use strict';
            const switchSelector = '#callemptytout';
            // undefined === 2min wait, 0 === 2min wait, 1 === 24hour wait
            const curr = mega.config.get('callemptytout');
            accountUI.inputs.switch.init(
                switchSelector,
                $(switchSelector).parent(),
                typeof curr === 'undefined' ? 1 : Math.abs(curr - 1),
                val => {
                    mega.config.setn('callemptytout', Math.abs(val - 1));
                    eventlog(99758, JSON.stringify([Math.abs(val - 1)]));
                }
            );
        }
    },
    callNotifications: {
        render: function() {
            'use strict';
            const switchSelector = '#callinout';
            const curr = mega.config.get('callinout');

            accountUI.inputs.switch.init(
                switchSelector,
                $(switchSelector).parent(),
                typeof curr === 'undefined' ? 1 : Math.abs(curr - 1),
                val => {
                    mega.config.setn('callinout', Math.abs(val - 1));
                    eventlog(99759, JSON.stringify([Math.abs(val - 1)]));
                }
            );
        }
    }
};

/**
 * S4 Object storage settings
 */
accountUI.s4 = {

    $container: null,

    init() {
        'use strict';

        if ((this.$container = ('.fm-account-s4', accountUI.$contentBlock)).length === 0) {
            return false;
        }

        this.renderEndpointsData();
        this.bindEvents();
    },

    renderEndpointsData() {
        'use strict';

        // Static endpoints data for now
        const endpoints = [
            [
                'eu-central-1.s4.mega.io',
                l.location_amsterdam
            ],
            [
                'ca-central-1.s4.mega.io',
                l.location_montreal
            ],
            [
                'ca-west-1.s4.mega.io',
                l.location_vancouver
            ]
        ];

        const tableNode = this.$container[0].querySelector('.secondary-table');
        const tipsNode = this.$container[0].querySelector('ul');
        let rowNode = null;

        tableNode.textContent = '';
        tipsNode.textContent = '';

        // Create table header
        rowNode = mCreateElement('tr', undefined, tableNode);
        mCreateElement('th', undefined, rowNode).textContent = l.s4_endpoint_header;
        mCreateElement('th', undefined, rowNode).textContent = l[17818];
        mCreateElement('th', undefined, rowNode);

        // Create enpoint rows
        for (const item of endpoints) {
            let subNode = null;

            // Create table header
            rowNode = mCreateElement('tr', undefined, tableNode);
            subNode = mCreateElement('td', undefined, rowNode);
            mCreateElement('a', { class: 'settings-lnk' }, subNode).textContent = item[0];
            mCreateElement('td', undefined, rowNode).textContent = item[1];
            subNode = mCreateElement('td', undefined, rowNode);

            // Create copy to clipboard button
            subNode = mCreateElement('button', {
                'class': 'mega-button small action copy',
                'data-url': item[0]
            }, subNode);
            mCreateElement('i', { class: 'sprite-fm-mono icon-copy' }, subNode);
        }

        // Fill URL exapmles in the tips
        mCreateElement('li', undefined, tipsNode).append(parseHTML(
            l.s4_s3_prefix_example.replace('%1', `s3.${endpoints[0][0]}`)
        ));
        mCreateElement('li', undefined, tipsNode).append(parseHTML(
            l.s4_iam_prefix_example.replace('%1', `iam.${endpoints[0][0]}`)
        ));
    },

    bindEvents() {
        'use strict';

        // Specs button evt in top banner
        $('.show-s4-specs', this.$container).rebind('click.openSpecs', () => {
            window.open('https://github.com/meganz/s4-specs', '_blank', 'noopener,noreferrer');
        });

        // Manage keys button in Access keys section
        $('.manage-s4-keys', this.$container).rebind('click.openKeys', () => {
            const cn = 'utils' in s4 && s4.utils.getContainersList();
            loadSubPage(cn.length ? `fm/${cn[0].h}/keys` : 'fm');
        });

        // Copy to clipboard buttons in Endpoints section
        $('.mega-button.copy', this.$container).rebind('click.copyUrl', (e) => {
            copyToClipboard(e.currentTarget.dataset.url, l.s4_endpoint_copied, 'hidden');
        });

        // Enable thumb previews switcher in thumb previews
        accountUI.inputs.switch.init(
            '.s4-thumb-switch',
            this.$container,
            mega.config.get('s4thumbs'),
            (val) => {
                mega.config.setn('s4thumbs', val ? 1 : undefined);
            }
        );
    }
};

/**
 * Functionality for the My Account page, Security section to change the user's password
 */
var accountChangePassword = {

    /**
     * Initialise the change password functionality
     */
    init:function() {

        'use strict';

        this.resetForm();
        this.initPasswordKeyupHandler();
        this.initChangePasswordButton();
    },

    /**
     * Reset the text inputs if coming back to the page
     */
    resetForm: function() {

        'use strict';

        $('#account-new-password').val('').trigger('blur').trigger('input');
        $('#account-confirm-password').val('').trigger('blur');
        $('.account-pass-lines').removeClass('good1 good2 good3 good4 good5');
    },

    /**
     * Initialise the handler to change the password strength indicator while typing the password
     */
    initPasswordKeyupHandler: function() {

        'use strict';

        var $newPasswordField = $('#account-new-password');
        var $changePasswordButton = $('.account.change-password .save-container');

        var bindStrengthChecker = function() {
            $newPasswordField.rebind('keyup.pwdchg input.pwdchg change.pwdchg', function() {

                // Estimate the password strength
                var password = $.trim($(this).val());
                var passwordLength = password.length;

                if (passwordLength === 0) {
                    $changePasswordButton.addClass('closed');
                }
                else {
                    $changePasswordButton.removeClass('closed');
                }
            });

            if ($newPasswordField.val().length) {
                // Reset strength after re-rendering.
                $newPasswordField.trigger('keyup.pwdchg');
            }
        };

        bindStrengthChecker();
    },



    /**
     * Initalise the change password button to verify the password (and 2FA if active) then change the password
     */
    initChangePasswordButton: function() {

        'use strict';

        // Cache selectors
        var $newPasswordField = $('#account-new-password');
        var $newPasswordConfirmField = $('#account-confirm-password');
        var $changePasswordButton = $('.account .change-password-button');
        var $passwordStrengthBar = $('.account-pass-lines');

        $changePasswordButton.rebind('click', function() {

            if ($(this).hasClass('disabled')) {
                return false;
            }

            var password = $newPasswordField.val();
            var confirmPassword = $newPasswordConfirmField.val();

            // Check if the entered passwords are valid or strong enough
            var passwordValidationResult = security.isValidPassword(password, confirmPassword);

            // If bad result
            if (passwordValidationResult !== true) {

                // Show error message
                msgDialog('warninga', l[135], passwordValidationResult, false, function() {
                    $newPasswordField.val('');
                    $newPasswordConfirmField.val('');
                    $newPasswordField.trigger('input').trigger('focus');
                    $newPasswordConfirmField.trigger('blur');
                });

                // Return early to prevent password change
                return false;
            }

            // Trigger save password on browser with correct email
            accountChangePassword.emulateFormSubmission(password);

            // Proceed to change the password
            accountChangePassword.changePassword(password)
                .then(() => {

                    // Success
                    showToast('settings', l[725]);
                })
                .catch((ex) => {

                    if (ex === EFAILED || ex === EEXPIRED) {
                        msgDialog('warninga', l[135], l[19192]);
                    }
                    else if (String(ex).includes(l[22126])) {
                        msgDialog('warninga', l[135], l[22126]);
                    }
                    else if (ex !== EBLOCKED) {
                        tell(ex);
                    }
                })
                .finally(() => {
                    // Clear password fields
                    accountChangePassword.resetForm();
                    $('#account-new-password').val('');
                    $('#account-confirm-password').val('');

                    // Update the account page
                    accountUI();
                });
        });
    },

    /**
     * Emulate form submission to trigger correctly behaved password manager update.
     * @param {String} password The new password
     */
    emulateFormSubmission: function(password) {

        'use strict';

        var form = document.createElement("form");
        form.className = 'hidden';

        var elem1 = document.createElement("input");
        var elem2 = document.createElement("input");
        var elemBtn = document.createElement("input");

        elem1.value = u_attr.email;
        elem1.type = 'email';
        form.appendChild(elem1);

        elem2.value = password;
        elem2.type = 'password';
        form.appendChild(elem2);

        elemBtn.type = 'submit';
        form.appendChild(elemBtn);

        document.body.appendChild(form);

        $(form).on('submit', function() {
            return false;
        });

        elemBtn.click();

        document.body.removeChild(form);
    },

    /**
     * Change the user's password
     * @param {String} newPassword The new password
     */
    async changePassword(newPassword) {
        'use strict';
        let twoFactorPin = null;

        // Check their current Account Authentication Version before proceeding
        const [
            hasTwoFactor,
            accountAuthVersion
        ] = await Promise.all([twofactor.isEnabledForAccount(), security.changePassword.checkAccountVersion()]);

        // Check if 2FA is enabled on their account
        if (hasTwoFactor) {

            // Show the verify 2FA dialog to collect the user's PIN
            twoFactorPin = await twofactor.verifyActionDialog.init();
        }

        const same = await security.changePassword.isPasswordTheSame($.trim(newPassword), accountAuthVersion);

        // You have entered your current password, please enter a new password.
        if (same) {
            throw l[22126];
        }

        if (accountAuthVersion === 2) {
            return security.changePassword.newMethod(newPassword, twoFactorPin);
        }

        return security.changePassword.oldMethod(newPassword, twoFactorPin);
    }
};

/**
 * Functionality for the My Account page, Security section to change the user's email
 */
var accountChangeEmail = {

    /**
     * Initialise the change email functionality
     */
    init:function() {

        'use strict';

        this.resetForm();
        this.initEmailKeyupHandler();
        this.initChangeEmailButton();
    },

    /**
     * Reset the text inputs if coming back to the page
     */
    resetForm: function() {

        'use strict';

        // Reset change email fields after change
        $('#current-email').val(u_attr.email).blur();
        $('#account-email').val('');
        $('.fm-account-change-email').addClass('hidden');
    },

    /**
     * Initialise the handler to show an information message while typing the email
     */
    initEmailKeyupHandler: function() {

        'use strict';

        // Cache selectors
        var $newEmail = $('#account-email');
        var $emailInfoMessage = $('.fm-account-change-email');
        var $changeEmailButton = $('.account .change-email-button');

        // On text entry in the new email text field
        $newEmail.rebind('keyup', function() {

            const newEmailValue = $.trim($newEmail.val()).toLowerCase();

            if (newEmailValue && u_attr.email.toLowerCase() !== newEmailValue) {
                // Show information message
                $emailInfoMessage.slideDown();
                $changeEmailButton.closest('.save-container').removeClass('closed');
            }
            else {
                // Show information message
                $emailInfoMessage.slideUp();
                $changeEmailButton.closest('.save-container').addClass('closed');

                if (u_attr.email.toLowerCase() === newEmailValue) {
                    $newEmail.megaInputsShowError(l.m_change_email_same);
                }
            }

            $.tresizer();
        });
    },

    /**
     * Initalise the change email button to verify the email, get the 2FA code (if active) then change the email
     */
    initChangeEmailButton: function() {

        'use strict';

        // Cache selectors
        var $changeEmailButton = $('.account .change-email-button');
        var $newEmail = $('#account-email');

        // On Change Email button click
        $changeEmailButton.rebind('click', function() {

            if ($(this).hasClass('disabled')) {
                return false;
            }
            // Get the new email address
            var newEmailRaw = $newEmail.val();
            var newEmail = $.trim(newEmailRaw).toLowerCase();

            // If not a valid email, show an error
            if (!isValidEmail(newEmail)) {
                $newEmail.megaInputsShowError(l[1513]);
                return false;
            }

            // If there is text in the email field and it doesn't match the existing one
            if (newEmail !== '' && u_attr.email.toLowerCase() !== newEmail) {

                // Check if 2FA is enabled on their account
                twofactor.isEnabledForAccount()
                    .then((result) => {

                        // If 2FA is enabled
                        if (result) {

                            // Show the verify 2FA dialog to collect the user's PIN
                            return twofactor.verifyActionDialog.init();
                        }
                    })
                    .then((twoFactorPin) => accountChangeEmail.continueChangeEmail(newEmail, twoFactorPin || null))
                    .catch((ex) => ex !== EBLOCKED && tell(ex));
            }
        });
    },

    /**
     * Initiate the change email request to the API
     * @param {String} newEmail The new email
     * @param {String|null} twoFactorPin The 2FA PIN code or null if not applicable
     */
    continueChangeEmail: function(newEmail, twoFactorPin) {

        'use strict';

        loadingDialog.show();

        // Prepare the request
        var requestParams = {
            a: 'se',            // Set Email
            aa: 'a',
            e: newEmail,        // The new email address
            i: requesti         // Last request ID
        };

        // If the 2FA PIN was entered, send it with the request
        if (twoFactorPin !== null) {
            requestParams.mfa = twoFactorPin;
        }

        // Change of email request
        api_req(requestParams, {
            callback: function(result) {

                loadingDialog.hide();

                // If something went wrong with the 2FA PIN
                if (result === EFAILED || result === EEXPIRED) {
                    msgDialog('warninga', l[135], l[19192]);
                }

                // If they have already requested a confirmation link for that email address, show an error
                else if (result === -12) {
                    msgDialog('warninga', l[135], l.resend_email_error,  mega.icu.format(l.resend_email_error_info, 2));
                }

                // If they have already requested the confirmation links twice in one hour, show an error
                else if (result === -6) {
                    msgDialog(
                        'warninga', l[135], l.change_email_error,
                        mega.icu.format(l.change_email_error_info, u_attr.b ? 10 : 2)
                    );
                }

                // EACCESS, the email address is already in use or current user is invalid. (less likely).
                else if (typeof result === 'number' && result === -11) {
                    return msgDialog('warninga', l[135], l[19562]);
                }

                // If something else went wrong, show an error
                else if (typeof result === 'number' && result < 0) {
                    msgDialog('warninga', l[135], l[47]);
                }

                else {
                    // Success
                    fm_showoverlay();

                    $('.awaiting-confirmation').removeClass('hidden');

                    localStorage.new_email = newEmail;
                }
            }
        });
    }
};

(function _dialogs(global) {
    'use strict'; /* jshint -W074 */

    // @private pointer to global fm-picker-dialog
    var $dialog = false;
    // @private reference to active dialog section
    var section = 'cloud-drive';
    // @private shared nodes metadata
    var shares = Object.create(null);
    if (d) {
        window.mcshares = shares;
    }

    // ------------------------------------------------------------------------
    // ---- Private Functions -------------------------------------------------

    /**
     * Find shared folders marked read-only and disable it in dialog.
     * @private
     */
    var disableReadOnlySharedFolders = function() {
        var $ro = $('.fm-picker-dialog-tree-panel.shared-with-me .dialog-content-block span[id^="mctreea_"]');
        var targets = $.selected || [];

        if (!$ro.length) {
            if ($('.fm-picker-dialog-button.shared-with-me', $dialog).hasClass('active')) {
                // disable import btn
                $('.dialog-picker-button', $dialog).addClass('disabled');
            }
        }
        $ro.each(function(i, v) {
            var h = $(v).attr('id').replace('mctreea_', '');
            var s = shares[h] = Object.create(null);
            var n = M.d[h];

            while (n && !n.su) {
                n = M.d[n.p];
            }

            if (n) {
                s.share = n;
                s.owner = n.su;
                s.level = n.r;

                for (i = targets.length; i--;) {
                    if (M.isCircular(n.h, targets[i])) {
                        s.circular = true;
                        break;
                    }
                }
            }

            if (!n || !n.r) {
                $(v).addClass('disabled');
            }
        });
    };

    /**
     * Disable circular references and read-only shared folders.
     * @private
     */
    var disableFolders = function() {
        $('*[id^="mctreea_"]').removeClass('disabled');

        if ($.moveDialog) {
            M.disableCircularTargets('#mctreea_');
        }
        else if ($.selectFolderDialog && $.fileRequestNew) {
            const getIdAndDisableDescendants = (elem) => {
                const handle = String($(elem).attr('id')).replace('mctreea_', '');
                if (handle) {
                    M.disableDescendantFolders(handle, '#mctreea_');
                }
            };

            const $allFolders = $('*[id^="mctreea_"]', $dialog);
            const $sharedAndFileRequestFolders = $('*[id^="mctreea_"]', $dialog)
                .children('.file-request-folder, .shared-folder');

            // All parent file request and shared folder
            $sharedAndFileRequestFolders.closest('.nw-fm-tree-item')
                .addClass('disabled');

            // Filter shared folder and disable descendants
            const filteredSharedFolders = $sharedAndFileRequestFolders.filter('.shared-folder')
                .closest('.nw-fm-tree-item');

            if (filteredSharedFolders.length) {
                for (let i = 0; i < filteredSharedFolders.length; i++) {
                    getIdAndDisableDescendants(filteredSharedFolders[i]);
                }
            }

            // Check all linked folders and disable descendants
            const filteredLinkedFolders = $allFolders
                .filter('.linked')
                .addClass('disabled');

            if (filteredLinkedFolders.length) {
                for (let i = 0; i < filteredLinkedFolders.length; i++) {
                    getIdAndDisableDescendants(filteredLinkedFolders[i]);
                }
            }
        }
        else if (!$.copyToUpload) {
            var sel = $.selected || [];

            for (var i = sel.length; i--;) {
                $('#mctreea_' + String(sel[i]).replace(/[^\w-]/g, '')).addClass('disabled');
            }
        }

        disableReadOnlySharedFolders();
    };

    /**
     * Retrieve array of non-circular nodes
     * @param {Array} [selectedNodes]
     * @returns {Array}
     * @private
     */
    var getNonCircularNodes = function(selectedNodes) {
        var r = [];

        if ($.mcselected) {
            const c = M.c[$.mcselected] || {};

            selectedNodes = selectedNodes || $.selected || [];

            for (var i = selectedNodes.length; i--;) {
                if ($.moveDialog && M.isCircular(selectedNodes[i], $.mcselected)) {
                    continue; // Ignore circular targets if move dialog is active
                }

                if (selectedNodes[i] === $.mcselected) {
                    continue; // If the source node is equal to target node
                }

                if (c[selectedNodes[i]]) {
                    continue; // If the target folder already contains this node
                }

                r.push(selectedNodes[i]);
            }
        }

        return r;
    };

    /**
     * Retrieves a list of currently selected target chats
     * @private
     */
    var getSelectedChats = function() {
        var chats = $('.nw-contact-item.selected', $dialog).attrs('id');
        chats = chats.map(function(c) {
            return String(c).replace('cpy-dlg-chat-itm-spn-', '');
        });
        return chats;
    };

    /**
     * Set the dialog button state to either disabled or enabled
     * @param {Object} $btn The jQuery's node or selector
     * @private
     */
    var setDialogButtonState = function($btn) {
        $btn = $($btn);

        if (section === 'conversations') {
            if (getSelectedChats().length) {
                $btn.removeClass('disabled');
            }
            else {
                $btn.addClass('disabled');
            }
        }
        else if (!$.mcselected) {
            $btn.addClass('disabled');
        }
        else if ($.selectFolderDialog && section === 'cloud-drive' && $.mcselected !== M.RootID) {
            $btn.removeClass('disabled');
        }
        else {
            var forceEnabled = $.copyToShare || $.copyToUpload || $.onImportCopyNodes || $.saveToDialog || $.nodeSaveAs;

            console.assert(!$.copyToShare || Object($.selected).length === 0, 'check this...');

            if (!forceEnabled && !getNonCircularNodes().length) {
                $btn.addClass('disabled');
            }
            else {
                $btn.removeClass('disabled');
            }
        }

        // Set Create folder label
        if (section === 's4' && M.tree.s4 && M.tree.s4[$.mcselected]) {
            $('.dialog-newfolder-button span', $dialog).text(l.s4_create_bkt);
        }
        else {
            $('.dialog-newfolder-button span', $dialog).text(l[68]);
        }
    };

    /**
     * Select tree item node
     * @param {String} h The node handle
     */
    var selectTreeItem = function(h) {
        queueMicrotask(() => {
            if (section === 'conversations') {
                $('#cpy-dlg-chat-itm-spn-' + h, $dialog).trigger('click');
            }
            else if (!$('#mctreesub_' + h, $dialog).hasClass('opened')) {
                $('#mctreea_' + h, $dialog).trigger('click');
            }
        });
    };

    /**
     * Render target breadcrumb
     * @param {String} [aTarget] Target node handle
     * @private
     */
    var setDialogBreadcrumb = function(aTarget) {
        let path = false;
        let names = Object.create(null);
        const titles = Object.create(null);
        const dialog = $dialog[0];
        var autoSelect = $.copyToUpload && !$.copyToUpload[2];

        if (section === 'conversations') {
            const chats = getSelectedChats();
            if (chats.length > 1) {
                path = [u_handle, 'contacts'];
                names[u_handle] = l[23755];
            }
            else {
                aTarget = chats[0] || String(aTarget || '').split('/').pop();
            }
            if (aTarget && String(aTarget).indexOf("#") > -1) {
                aTarget = aTarget.split("#")[0];
            }
        }

        // Update global $.mcselected with the target handle
        $.mcselected = aTarget && aTarget !== 'transfers' ? aTarget : undefined;
        path = path || M.getPath($.mcselected);

        titles[M.RootID] = l[164];
        titles[M.RubbishID] = l[167];
        titles.shares = l[5542];
        titles.contacts = l[17765];

        if (path.length === 1) {
            names = titles;
        }

        if ($.mcselected && !path.length) {
            // The selected node is likely not in memory, try to rely on DOM and find the ancestors
            var el = $dialog[0].querySelector('#mctreea_' + aTarget);

            if (el) {
                path.push(aTarget);
                names[aTarget] = el.querySelector(
                    '.nw-fm-tree-folder, .nw-fm-tree-icon-wrap'
                ).textContent;

                $(el).parentsUntil('.dialog-content-block', 'ul').each(function(i, elm) {
                    var h = String(elm.id).split('_')[1];
                    path.push(h);

                    elm = dialog.querySelector(
                        `#mctreea_${h} .nw-fm-tree-folder, #mctreea_${h} .nw-fm-tree-icon-wrap`
                    );
                    if (elm) {
                        names[h] = elm.textContent;
                    }
                });
            }
        }

        const scope = dialog.querySelector('.fm-picker-breadcrumbs');
        const dictionary = function _(handle) {

            // If this is gallery view, make it default to root path instead
            if (M.isGalleryPage(handle) || M.isAlbumsPage(0, handle)) {
                return _(M.RootID);
            }

            let name = names[handle] || M.getNameByHandle(handle) || '';
            let id = handle;
            let typeClass = 'folder';

            const typeClasses = {
                [M.RootID]: 'cloud-drive',
                [M.RubbishID]: 'rubbish-bin',
                'contacts': 'contacts',
                'shares': 'shared-with-me'
            };

            if (handle === M.RootID) {
                if (!folderlink) {
                    typeClass = typeClasses[handle];
                }
            }
            else if (typeClasses[handle]) {
                typeClass = typeClasses[handle];
            }
            else if (handle.length === 11) {
                typeClass = 'contact selectable-txt';
            }

            if (name === 'undefined') {
                name = '';
            }

            if (titles[handle]) {
                name = titles[handle];
            }

            if (section === 'conversations') {
                name = name && megaChat.plugins.emoticonsFilter.processHtmlMessage(escapeHTML(name)) || name;
            }
            else if (typeClass === 'contact') {
                name = '';
            }

            // Object storage icons
            if (section === 's4' && M.tree.s4) {
                if (M.tree.s4[handle]) {
                    name = l.obj_storage;
                    typeClass = 's4-object-storage';
                }
                else {
                    const cn = Object.values(M.tree.s4);

                    for (let i = 0; i < cn.length; ++i) {
                        if (M.tree[cn[i].h] && M.tree[cn[i].h][handle]) {
                            typeClass = 's4-buckets';
                        }
                    }
                }
            }

            if (autoSelect) {
                selectTreeItem(handle);
            }

            return {
                name,
                id,
                typeClass
            };
        };

        M.renderBreadcrumbs(path, scope, dictionary, id => {
            var $elm = $('#mctreea_' + id, $dialog);
            if ($elm.length) {
                $elm.trigger('click');
            }
            else {
                $('.fm-picker-dialog-button.active', $dialog).trigger('click');
            }
            $('.breadcrumb-dropdown.active', $dialog).removeClass('active');
            return false;
        });

        const placeholder = dialog.querySelector('.summary-input.placeholder');
        if (path.length) {
            placeholder.classList.add('correct-input');
            placeholder.classList.remove('high-light');
        }
        else {
            placeholder.classList.add('high-light');
            placeholder.classList.remove('correct-input');
            const filetypeIcon = placeholder.querySelector('.target-icon');
            filetypeIcon.classList.remove('icon-chat-filled', 'icon-folder-filled', 'sprite-fm-uni', 'sprite-fm-mono');
            filetypeIcon.classList.add(
                'sprite-fm-mono',
                section === 'conversations' ? 'icon-chat-filled' : 'icon-folder-filled'
            );
        }

        if ($.copyToUpload) {
            // auto-select entries once
            $.copyToUpload[2] = true;
        }
    };

    /**
     * Set selected items...
     * @param {*} [single] Single item mode
     * @private
     */
    var setSelectedItems = function(single) {
        var $icon = $('.summary-items-drop-icon', $dialog)
            .removeClass('icon-arrow-up drop-up icon-arrow-down drop-down hidden');
        var $div = $('.summary-items', $dialog).removeClass('unfold multi').empty();
        var names = Object.create(null);
        var items = $.selected || [];

        $('.summary-title.summary-selected-title', $dialog).text(l[19180]);

        if ($.saveToDialogNode) {
            items = [$.saveToDialogNode.h];
            names[$.saveToDialogNode.h] = $.saveToDialogNode.name;
        }
        if ($.copyToShare) {
            items = [];
            single = true;
            $('.summary-target-title', $dialog).text(l[19180]);
            $('.summary-selected', $dialog).addClass('hidden');
        }
        else if ($.selectFolderDialog) {
            $('.summary-target-title', $dialog).text(l[19181]);
            $('.summary-selected', $dialog).addClass('hidden');
        }
        else {
            $('.summary-target-title', $dialog).text(l[19181]);

            if ($.onImportCopyNodes) {
                $('.summary-selected', $dialog).addClass('hidden');
            }
            else {
                $('.summary-selected', $dialog).removeClass('hidden');
            }

            if ($.copyToUpload) {
                items = $.copyToUpload[0];

                for (var j = items.length; j--;) {
                    items[j].uuid = makeUUID();
                }
            }
        }

        if (!single) {
            $div.addClass('unfold');
            $div.safeAppend('<div class="item-row-group"></div>');
            $div = $div.find('.item-row-group');

        }

        if ($.nodeSaveAs) {
            items = [$.nodeSaveAs.h];
            names[$.nodeSaveAs.h] = $.nodeSaveAs.name || '';

            $('.summary-title.summary-selected-title', $dialog).text(l[1764]);
            var rowHtml = '<div class="item-row">' +
                '<div class="item-type-icon icon-text-24"></div>' +
                '<input id="f-name-input" class="summary-ff-name" type="text" value="' + escapeHTML($.nodeSaveAs.name)
                + '" placeholder="' + l[17506] + '" autocomplete="off"/> &nbsp; '
                + '</div>'
                + '<div class="whitespaces-input-warning"> <div class="arrow"></div> <span></span></div>'
                + '<div class="duplicated-input-warning"> <div class="arrow"></div> <span>'
                + l[17578] + '</span> </div>';

            $div.safeHTML(rowHtml);

            const ltWSpaceWarning = new InputFloatWarning($dialog);
            ltWSpaceWarning.check({type: 0, name: names[$.nodeSaveAs.h], ms: 0});

            $('#f-name-input', $div).rebind('keydown.saveas', function(e) {
                if (e.which === 13 || e.keyCode === 13) {
                    $('.dialog-picker-button', $dialog).trigger('click');
                }
            });
            $('#f-name-input', $div).rebind('keyup.saveas', () => {
                ltWSpaceWarning.check({type: 0});
            });
            if ($.saveAsDialog) {
                $('#f-name-input', $dialog).focus();
            }
        }
        else {
            for (var i = 0; i < items.length; i++) {
                var h = items[i];
                var n = M.getNodeByHandle(h) || Object(h);
                var name = names[h] || M.getNameByHandle(h) || n.name;
                var tail = '<i class="delete-item sprite-fm-mono icon-close-component "></i>';
                var summary = '<div class="summary-ff-name-ellipsis">@@</div>';
                var icon = fileIcon(n.h ? n : {name});
                var data = n.uuid || h;

                if (single) {
                    tail = '<span>(@@)</span>';
                    if (items.length < 2) {
                        tail = '';
                        summary = '<div class="summary-ff-name">@@</div>';
                    }
                }

                const pluralText = mega.icu.format(l.items_other_count, items.length - 1);
                $div.safeAppend(
                    '<div class="item-row" data-node="@@">' +
                    '    <div class="item-type-icon icon-@@-24"></div>' +
                        summary + ' &nbsp; ' + tail +
                    '</div>', data, icon, name, pluralText
                );

                if (single) {
                    break;
                }
            }
        }

        $icon.rebind('click', function() {
            $div.off('click.unfold');
            setSelectedItems(!single);
            return false;
        });

        if (single) {
            if (items.length > 1) {
                $div.addClass('multi').rebind('click.unfold', function() {
                    $icon.trigger('click');
                    return false;
                });
                $icon.addClass('icon-arrow-down drop-down');
            }
            else {
                $icon.addClass('hidden');
            }
        }
        else {
            initPerfectScrollbar($div);
            $icon.addClass('icon-arrow-up drop-up');

            $('.delete-item', $div).rebind('click', function() {
                var $row = $(this).parent();
                var data = $row.attr('data-node');

                $row.remove();
                initPerfectScrollbar($div);

                if ($.copyToUpload) {
                    for (var i = items.length; i--;) {
                        if (items[i].uuid === data) {
                            items.splice(i, 1);
                            break;
                        }
                    }
                    $('header h2', $dialog).text(getDialogTitle());
                }
                else {
                    array.remove(items, data);
                }

                if (items.length < 2) {
                    setSelectedItems(true);
                }

                return false;
            });
        }
    };

    /**
     * Get the button label for the dialog's main action button
     * @returns {String}
     * @private
     */
    var getActionButtonLabel = function() {
        if ($.albumImport) {
            return l.context_menu_import;
        }

        if ($.mcImport) {
            return l[236]; // Import
        }

        if ($.chatAttachmentShare && section !== 'conversations') {
            return l[776]; // Save
        }

        if ($.copyToShare) {
            return l[1344]; // Share
        }

        if ($.copyToUpload) {
            return l[372]; // Upload
        }

        if (section === 'conversations') {
            return l[1940]; // Send
        }

        if ($.saveToDialog || $.saveAsDialog) {
            if ($.nodeSaveAs && !$.nodeSaveAs.h) {
                return l[158];
            }
            return l[776]; // Save
        }

        if ($.moveDialog) {
            return l[62]; // Move
        }

        if ($.selectFolderDialog) {
            return l[1523]; // Select
        }

        return l[16176]; // Paste
    };

    /**
     * Get the dialog title based on operation
     * @returns {String}
     * @private
     */
    var getDialogTitle = function() {
        if ($.albumImport) {
            return l.context_menu_import;
        }

        if ($.mcImport) {
            return l[236]; // Import
        }

        if ($.chatAttachmentShare && section !== 'conversations') {
            return l[776]; // Save
        }

        if ($.copyToShare) {
            return l[1344]; // Share
        }

        if ($.copyToUpload) {
            var len = $.copyToUpload[0].length;

            if (section === 'conversations') {
                return mega.icu.format(l.upload_to_conversation, len);
            }

            if (section === 'shared-with-me') {
                return mega.icu.format(l.upload_to_share, len);
            }

            if (section === 's4') {
                return mega.icu.format(l.upload_to_s4, len);
            }

            return mega.icu.format(l.upload_to_cd, len);
        }

        if ($.saveToDialog) {
            return l[776]; // Save
        }

        if ($.saveAsDialog) {
            if ($.nodeSaveAs && !$.nodeSaveAs.h) {
                return l[22680];
            }
            return l[22678];
        }

        if (section === 'conversations') {
            return l[17764]; // Send to chat
        }

        if ($.moveDialog) {
            return l[62]; // Move
        }

        return l[63]; // Copy
    };

    /**
     * Getting contacts and view them in copy dialog
     */
    var handleConversationTabContent = function _handleConversationTabContent() {
        var myChats = megaChat.chats;
        var myContacts = M.getContactsEMails(true); // true to exclude requests (incoming and outgoing)
        var $conversationTab = $('.fm-picker-dialog-tree-panel.conversations');
        var $conversationNoConvTab = $('.dialog-empty-block.conversations');
        var $conversationTabHeader = $('.fm-picker-dialog-panel-header', $conversationTab);
        var $contactsContentBlock = $('.dialog-content-block', $conversationTab);
        var contactGeneratedList = "";
        var ulListId = 'cpy-dlg-chat-' + u_handle;
        var addedContactsByRecent = [];
        var nbOfRecent = 0;
        var isActiveMember = false;

        var createContactEntry = function _createContactEntry(name, email, handle) {
            if (name && handle && email) {
                var contactElem = '<span id="cpy-dlg-chat-itm-spn-' + handle
                    + '" class="nw-contact-item single-contact ';
                var contactStatus = 'offline';
                if (M.d[handle] && M.d[handle].presence) {
                    contactStatus = M.onlineStatusClass(M.d[handle].presence)[1];
                }
                contactElem += contactStatus + '">';
                contactElem += '<i class="encrypted-icon sprite-fm-uni icon-ekr"></i>';
                contactElem += '<span class="nw-contact-status"></span>';
                contactElem +=
                    '<span class="nw-contact-name selectable-txt">' +
                        megaChat.plugins.emoticonsFilter.processHtmlMessage(escapeHTML(name))
                    + '</span>';
                contactElem += '<span class="nw-contact-email">' + escapeHTML(email) + '</span>';
                contactElem = '<li id="cpy-dlg-chat-itm-' + handle + '">' + contactElem + '</li>';
                return contactElem;
            }
            return '';
        };

        var createGroupEntry = function _createGroupEntry(names, nb, handle, chatRoom) {
            if (names && names.length && nb && handle) {
                var groupElem = '<span id="cpy-dlg-chat-itm-spn-' + handle
                    + '" class="nw-contact-item multi-contact">';

                if (chatRoom && (chatRoom.type === "group" || chatRoom.type === "private")) {
                    groupElem += '<i class="encrypted-icon sprite-fm-uni icon-ekr"></i>';
                }
                else {
                    groupElem += '<span class="encrypted-spacer"></span>';
                }

                groupElem += '<i class="group-chat-icon sprite-fm-mono icon-contacts"></i>';

                var namesCombine = names[0];
                var k = 1;
                while (namesCombine.length <= 40 && k < names.length) {
                    namesCombine += ', ' + names[k];
                    k++;
                }
                if (k !== names.length) {
                    namesCombine = namesCombine.substr(0, 37);
                    namesCombine += '...';
                }
                groupElem += '<span class="nw-contact-name group selectable-txt">' +
                    megaChat.plugins.emoticonsFilter.processHtmlMessage(escapeHTML(namesCombine)) +
                    '</span>';
                groupElem += '<span class="nw-contact-group">' + mega.icu.format(l[24157], nb) + '</span>';
                groupElem = '<li id="cpy-dlg-chat-itm-' + handle + '">' + groupElem + '</li>';
                return groupElem;
            }
            return '';
        };

        if (myChats && myChats.length) {
            isActiveMember = myChats.every(function(chat) {
                return chat.members[u_handle] !== undefined && chat.members[u_handle] !== -1;
            });
            var top5 = 5; // defined in specs, top 5 contacts
            var sortedChats = obj_values(myChats.toJS());
            sortedChats.sort(M.sortObjFn("lastActivity", -1));
            for (var chati = 0; chati < sortedChats.length; chati++) {
                var chatRoom = sortedChats[chati];
                if (chatRoom.isArchived()) {
                    continue;
                }
                if (chatRoom.isReadOnly()) {
                    continue;
                }
                var isValidGroupOrPubChat = false;
                if (chatRoom.type === 'group') {
                    if (!$.len(chatRoom.members)) {
                        continue;
                    }
                    isValidGroupOrPubChat = true;
                }
                else if (
                    chatRoom.type === "public" &&
                    chatRoom.membersSetFromApi &&
                    chatRoom.membersSetFromApi.members[u_handle] >= 2
                ) {
                    isValidGroupOrPubChat = true;
                }

                if (isValidGroupOrPubChat) {
                    var gNames = [];
                    if (chatRoom.topic) {
                        gNames.push(chatRoom.topic);
                    }
                    else {
                        ChatdIntegration._ensureContactExists(chatRoom.members);
                        for (var grHandle in chatRoom.members) {
                            if (gNames.length > 4) {
                                break;
                            }

                            if (grHandle !== u_handle) {
                                gNames.push(M.getNameByHandle(grHandle));
                            }
                        }
                    }
                    if (gNames.length) {
                        if (nbOfRecent < top5) {
                            var gElem = createGroupEntry(
                                gNames,
                                Object.keys(chatRoom.members).length,
                                chatRoom.roomId,
                                chatRoom
                            );
                            contactGeneratedList += gElem;
                        }
                        else {
                            myContacts.push({
                                id: Object.keys(chatRoom.members).length,
                                name: gNames[0], handle: chatRoom.roomId, isG: true,
                                gMembers: gNames
                            });
                        }
                        nbOfRecent++;

                    }
                }
                else if (nbOfRecent < top5) {
                    var contactHandle;
                    for (var ctHandle in chatRoom.members) {
                        if (ctHandle !== u_handle) {
                            contactHandle = ctHandle;
                            break;
                        }
                    }
                    if (
                        contactHandle &&
                        M.u[contactHandle] && M.u[contactHandle].c === 1 && M.u[contactHandle].m
                    ) {
                        addedContactsByRecent.push(contactHandle);
                        var ctElemC = createContactEntry(
                            M.getNameByHandle(contactHandle),
                            M.u[contactHandle].m,
                            contactHandle
                        );
                        contactGeneratedList += ctElemC;
                        nbOfRecent++;
                    }
                }
            }
        }

        if (myContacts && myContacts.length) {
            myContacts.sort(M.sortObjFn("name", 1));

            for (var a = 0; a < myContacts.length; a++) {
                if (addedContactsByRecent.includes(myContacts[a].handle)) {
                    continue;
                }
                var ctElem;
                if (!myContacts[a].isG) {
                    ctElem = createContactEntry(myContacts[a].name, myContacts[a].id, myContacts[a].handle);
                }
                else {
                    ctElem = createGroupEntry(
                        myContacts[a].gMembers,
                        myContacts[a].id,
                        myContacts[a].handle,
                        megaChat.chats[myContacts[a].handle]
                    );
                }
                contactGeneratedList += ctElem;
            }
        }

        if (
            myChats && myChats.length && isActiveMember ||
            myContacts && myContacts.length
        ) {
            contactGeneratedList = '<ul id="' + ulListId + '">' + contactGeneratedList + '</ul>';
            $contactsContentBlock.safeHTML(contactGeneratedList);
            $conversationTab.addClass('active');
            $conversationNoConvTab.removeClass('active');
            $conversationTabHeader.removeClass('hidden');
        }
        else {
            $conversationTab.removeClass('active');
            $conversationNoConvTab.addClass('active');
            $conversationTabHeader.addClass('hidden');
        }
    };

    /**
     * Show content or empty block.
     * @param {String} tabClass dialog tab class name.
     * @param {String} parentTag tag of source element.
     * @private
     */
    const showDialogContent = (tabClass, parentTag) => {
        const $tab = $(`.fm-picker-dialog-tree-panel.${tabClass}`, $dialog);

        if ($(`.dialog-content-block ${parentTag}`, $tab).children().length) {
            // Items available, hide empty message
            $('.dialog-empty-block', $dialog).removeClass('active');
            $('.fm-picker-dialog-panel-header', $tab).removeClass('hidden');
            $tab.addClass('active'); // TODO check why this was only here
        }
        else {
            // Empty message, no items available
            $(`.dialog-empty-block.${tabClass}`, $dialog).addClass('active');
            $('.fm-picker-dialog-panel-header', $tab).addClass('hidden');
        }
    };


    /**
     * Handle DOM directly, no return value.
     * @param {String} tabClass dialog tab class name.
     * @param {String} parentTag tag of source element.
     * @param {String} htmlContent html content.
     * @returns {void} void
     * @private
     */
    const handleDialogTabContent = (tabClass, parentTag, htmlContent) => {
        const $tab = $(`.fm-picker-dialog-tree-panel.${tabClass}`, $dialog);
        const $contentBlock =  $('.dialog-content-block', $tab);
        const html = String(htmlContent)
            .replace(/treea_/ig, 'mctreea_')
            .replace(/treesub_/ig, 'mctreesub_')
            .replace(/treeli_/ig, 'mctreeli_');

        $contentBlock.empty().safeHTML(html);
        $('.s4-static-item', $contentBlock).remove();

        showDialogContent(tabClass, parentTag);
    };

    /**
     * Build tree for a move/copy dialog.
     * @private
     */
    var buildDialogTree = function() {
        var $dpa = $('.fm-picker-dialog-panel-arrows', $dialog).removeClass('hidden');

        if (section === 'cloud-drive' || section === 'folder-link') {
            M.buildtree(M.d[M.RootID], 'fm-picker-dialog', 'cloud-drive');
            showDialogContent('cloud-drive', 'ul');
        }
        else if (section === 'shared-with-me') {
            M.buildtree({h: 'shares'}, 'fm-picker-dialog');
        }
        else if (section === 'rubbish-bin') {
            M.buildtree({h: M.RubbishID}, 'fm-picker-dialog');
        }
        else if (section === 'conversations') {
            if (window.megaChatIsReady) {
                // prepare Conversation Tab if needed
                $dpa.addClass('hidden');
                handleConversationTabContent();
            }
            else {
                console.error('MEGAchat is not ready');
            }
        }
        else if (section === 's4') {
            M.buildtree({h: 's4'}, 'fm-picker-dialog');
            showDialogContent('s4', 'ul');
        }

        if (!treesearch) {
            $('.nw-fm-tree-item', '.fm-picker-dialog')
                .removeClass('expanded active opened selected');
            $('.nw-fm-tree-item + ul', '.fm-picker-dialog').removeClass('opened');
        }

        disableFolders();
        onIdle(() => {
            initPerfectScrollbar($('.right-pane.active .dialog-tree-panel-scroll', $dialog));

            // Place tooltip for long names
            const folderNames = $dialog[0]
                .querySelectorAll('.nw-fm-tree-folder:not(.inbound-share), .nw-fm-tree-icon-wrap');

            for (let i = folderNames.length; i--;) {

                const elm = folderNames[i];

                if (elm.scrollWidth > elm.offsetWidth) {
                    elm.setAttribute('data-simpletip', elm.textContent);
                    elm.classList.add('simpletip');
                }
            }
        });
    };

    /**
     * Dialogs content handler
     * @param {String} dialogTabClass Dialog tab class name.
     * @param {String} [buttonLabel] Action button label.
     * @private
     */
    var handleDialogContent = function(dialogTabClass, buttonLabel) {
        section = dialogTabClass || 'cloud-drive';
        buttonLabel = buttonLabel || getActionButtonLabel();

        let title = '';

        var $pickerButtons = $('.fm-picker-dialog-button', $dialog).removeClass('active');
        $('.dialog-sorting-menu', $dialog).addClass('hidden');
        $('.dialog-empty-block', $dialog).removeClass('active');
        $('.fm-picker-dialog-tree-panel', $dialog).removeClass('active');
        $('.fm-picker-dialog-panel-arrows', $dialog).removeClass('active');
        $('.fm-picker-dialog-desc', $dialog).addClass('hidden'); // Hide description
        $dialog.removeClass('fm-picker-file-request');
        $('button.js-close', $dialog).addClass('hidden');

        // inherited dialog content...
        var html = section !== 'conversations' && $('.content-panel.' + section).html();
        var $permissionSelect = $('.permissions.dropdown-input', $dialog);
        var $permissionIcon = $('i.permission', $permissionSelect);
        var $permissionOptions = $('.option', $permissionSelect);

        // all the different buttons
        // var $cloudDrive = $pickerButtons.filter('[data-section="cloud-drive"]');
        const $s4 = $pickerButtons.filter('[data-section="s4"]');
        var $sharedMe = $pickerButtons.filter('[data-section="shared-with-me"]');
        var $conversations = $pickerButtons.filter('[data-section="conversations"]');
        var $rubbishBin = $pickerButtons.filter('[data-section="rubbish-bin"]');


        // Action button label
        $('.dialog-picker-button span', $dialog).text(buttonLabel);

        // if the site is initialized on the chat, $.selected may be `undefined`,
        // which may cause issues doing .length on it in dialogs.js, so lets define it as empty array
        // if is not def.
        $.selected = $.selected || [];

        $conversations.addClass('hidden');
        $rubbishBin.addClass('hidden');

        if (
            ($.dialog === 'copy' && $.selected.length && !$.saveToDialog || $.copyToUpload)
            && !(
                // Don't allow copying incoming shared folders to chat as it is currently not functional
                $.dialog === 'copy'
                && $.selected.filter(n => !M.isFileNode(M.getNodeByHandle(n)) && M.getNodeRoot(n) === 'shares').length
            )
        ) {
            $conversations.removeClass('hidden');
        }

        const nodeRoot = M.getNodeRoot($.selected[0]);
        if (!u_type || $.copyToShare || $.mcImport || $.selectFolderDialog
            || $.saveAsDialog) {
            $rubbishBin.addClass('hidden');
            $conversations.addClass('hidden');
        }
        if (nodeRoot === M.RubbishID || $.copyDialog || $.moveDialog) {
            $rubbishBin.addClass('hidden');
        }

        if (nodeRoot === M.RubbishID || $.copyToShare || $.selectFolderDialog
            || !u_type || M.currentdirid === 'devices' || $.albumImport) {
            $sharedMe.addClass('hidden');
        }
        else {
            $sharedMe.removeClass('hidden');
        }

        if ('kernel' in s4 && M.tree.s4 &&
            ($.copyDialog || $.moveDialog || $.selectFolderDialog && !$.fileRequestNew)) {
            $s4.removeClass('hidden');
        }
        else {
            $s4.addClass('hidden');
        }

        if ($.copyToUpload) {
            $('.fm-picker-notagain', $dialog).removeClass('hidden');
            $('footer', $dialog).removeClass('dialog-bottom');
        }
        else {
            $('.fm-picker-notagain', $dialog).addClass('hidden');
            $('footer', $dialog).addClass('dialog-bottom');
        }

        handleDialogTabContent(section, section === 'conversations' ? 'div' : 'ul', html);

        buildDialogTree();

        // 'New Folder' button
        if (section === 'shared-with-me' || section === 'conversations') {
            $('.dialog-newfolder-button', $dialog).addClass('hidden');
        }
        else {
            $('.dialog-newfolder-button', $dialog).removeClass('hidden');
        }

        // Reset the value of permission and permissions list
        if ($permissionSelect.length > 0) {

            $permissionSelect.attr('data-access', 'read-only');
            $permissionIcon.attr('class', 'permission sprite-fm-mono icon-read-only');
            $('> span', $permissionSelect).text(l[7534]);
            $permissionOptions.removeClass('active');
            $('.permissions .option[data-access="read-only"]', $dialog).addClass('active');
            $('.permissions .option[data-state="active"]', $dialog).removeAttr('data-state');
        }

        // If copying from contacts tab (Ie, sharing)
        if (!$.saveToDialog && section === 'cloud-drive' && (M.currentrootid === 'chat' || $.copyToShare)) {
            $('.dialog-newfolder-button', $dialog).addClass('hidden');
            $permissionSelect.removeClass('hidden');
            bindDropdownEvents($permissionSelect);

            $permissionOptions.rebind('click.selectpermission', function() {
                var $this = $(this);

                $permissionIcon.attr('class', 'permission sprite-fm-mono ' + $this.attr('data-icon'));
                $permissionSelect.attr('data-access', $this.attr('data-access'));
            });
        }
        else if ($.selectFolderDialog) {
            $permissionSelect.addClass('hidden');
            if ($.fileRequestNew) {
                $dialog.addClass('fm-picker-file-request');

                $('.fm-picker-dialog-desc', $dialog)
                    .removeClass('hidden');
                $('.fm-picker-dialog-desc p', $dialog)
                    .text(l.file_request_select_folder_desc);
                $('button.js-close', $dialog).removeClass('hidden');

                title = l.file_request_select_folder_title;
            }
            else {
                title = l[16533];
            }
        }
        else {
            $permissionSelect.addClass('hidden');
        }

        if ($.chatAttachmentShare && section !== 'conversations') {
            $permissionSelect.addClass('hidden');
        }

        // 'New contact' button
        if (section === 'conversations') {
            $('.dialog-newcontact-button', $dialog).removeClass('hidden');
        }
        else {
            $('.dialog-newcontact-button', $dialog).addClass('hidden');
        }

        // Activate tab
        $('.fm-picker-dialog-button[data-section="' + section + '"]', $dialog).addClass('active');

        $('header h2', $dialog).text(title || getDialogTitle());
    };

    /**
     * Handle opening dialogs and content
     * @param {String} aTab The section/tab to activate
     * @param {String} [aTarget] The target folder for the operation
     * @param {String|Object} [aMode] Copy dialog mode (share, save, etc)
     */
    var handleOpenDialog = function(aTab, aTarget, aMode) {
        // Save an snapshot of selected nodes at time of invocation, given $.hideContextMenu(); could swap
        // the internal list as part of cleanup performed during closing context-menus, e.g. for in-shares
        const preUserSelection = window.selectionManager && selectionManager.get_selected() || $.selected;

        onIdle(function() {
            /** @name $.copyDialog */
            /** @name $.moveDialog */
            /** @name $.selectFolderDialog */
            /** @name $.saveAsDialog */
            $[$.dialog + 'Dialog'] = $.dialog;

            if (aMode) {
                /** @name $.copyToShare */
                /** @name $.copyToUpload */
                /** @name $.saveToDialog */
                $[aMode.key || aMode] = aMode.value || true;
            }

            if (preUserSelection && preUserSelection.length) {
                const postSelection = window.selectionManager && selectionManager.get_selected() || $.selected;

                if (preUserSelection !== postSelection) {
                    $.selected = preUserSelection;
                    if (window.selectionManager) {
                        selectionManager.reinitialize();
                    }
                }
            }

            $('.search-bar input', $dialog).val('');
            $('.search-bar.placeholder .search-icon-reset', $dialog).addClass('hidden');
            handleDialogContent(typeof aTab === 'string' && aTab);
            if (aTab === 'conversations') {
                setDialogBreadcrumb(M.currentrootid === 'chat' && aTarget !== M.RootID ? aTarget : '');
            }
            else {
                setDialogBreadcrumb(aTarget);
            }
            setDialogButtonState($('.dialog-picker-button', $dialog).addClass('active'));
            setSelectedItems(true);
        });

        $.hideContextMenu();
        $dialog.removeClass('duplicate');

        console.assert($dialog, 'The dialogs subsystem is not yet initialized!...');
    };

    /** Checks if the user can access dialogs copy/move/share */
    var isUserAllowedToOpenDialogs = function() {
        console.assert($dialog, 'The dialogs subsystem is not yet initialized!');

        return $dialog && !M.isInvalidUserStatus();
    };

    // ------------------------------------------------------------------------
    // ---- Public Functions --------------------------------------------------

    /**
     * Refresh copy/move dialog content with newly created directory.
     * @global
     */
    global.refreshDialogContent = function refreshDialogContent() {
        var tab = $.cfsection || 'cloud-drive';

        var b = $('.content-panel.' + tab).html();

        // Before refresh content remember what is opened.
        var $openedNodes = $('ul.opened[id^="mctreesub_"]', $dialog);
        $.openedDialogNodes = {};

        for (var i = $openedNodes.length; i--;) {

            var id = $openedNodes[i].id.replace('mctreesub_', '');
            $.openedDialogNodes[id] = 1;
        }

        handleDialogTabContent(tab, 'ul', b);
        buildDialogTree();

        delete $.cfsection; // safe deleting
        delete $.openedDialogNodes;

        disableFolders($.moveDialog && 'move');
        initPerfectScrollbar($('.right-pane.active .dialog-tree-panel-scroll', $dialog));
    };

    /**
     * A version of the Copy dialog used in the contacts page for sharing.
     * @param {String} [u_id] Share to contact handle.
     * @global
     */
    global.openCopyShareDialog = function openCopyShareDialog(u_id) {
        // Not allowed chats
        if (isUserAllowedToOpenDialogs()) {
            M.safeShowDialog('copy', function() {
                $.shareToContactId = u_id;
                handleOpenDialog('cloud-drive', false, 'copyToShare');
                return $dialog;
            });
        }

        return false;
    };

    /**
     * A version of the Copy dialog used when uploading.
     * @param {Array} files The files being uploaded.
     * @param {Object} [emptyFolders] Empty folders to create hierarchy for.
     * @global
     */
    global.openCopyUploadDialog = function openCopyUploadDialog(files, emptyFolders) {
        // Is allowed chats
        if (isUserAllowedToOpenDialogs()) {
            M.safeShowDialog('copy', function() {
                var tab = M.chat ? 'conversations' : M.currentrootid === 'shares' ?
                    'shared-with-me' : M.currentrootid === 's4' ? 's4' : 'cloud-drive';
                var dir = M.currentdirid === 'transfers' ? M.lastSeenCloudFolder || M.RootID : M.currentdirid;
                closeMsg();
                handleOpenDialog(tab, dir, { key: 'copyToUpload', value: [files, emptyFolders] });
                return uiCheckboxes($dialog);
            });
        }

        return false;
    };

    /**
     * Generic function to open the Copy dialog.
     * @global
     */
    global.openCopyDialog = function openCopyDialog(activeTab, onBeforeShown) {
        // Is allowed chats
        if (isUserAllowedToOpenDialogs()) {
            if ($.dialog === 'onboardingDialog') {
                closeDialog();
            }
            M.safeShowDialog('copy', function() {
                if (typeof activeTab === 'function') {
                    onBeforeShown = activeTab;
                    activeTab = false;
                }
                if (typeof onBeforeShown === 'function') {
                    onBeforeShown($dialog);
                }
                handleOpenDialog(activeTab, M.RootID);
                return $dialog;
            });
        }

        return false;
    };

    /**
     * Generic function to open the Move dialog.
     * @global
     */
    global.openMoveDialog = function openMoveDialog() {
        // Not allowed chats
        if (isUserAllowedToOpenDialogs()) {
            M.safeShowDialog('move', function() {
                handleOpenDialog(0, M.RootID);
                return $dialog;
            });
        }

        return false;
    };

    /**
     * A version of the Copy dialog used for "Save to" in chat.
     * @global
     */
    global.openSaveToDialog = function openSaveToDialog(node, cb, activeTab) {
        // Not allowed chats
        if (isUserAllowedToOpenDialogs()) {
            M.safeShowDialog('copy', function() {
                $.saveToDialogCb = cb;
                $.saveToDialogNode = node;
                handleOpenDialog(activeTab, M.RootID, activeTab !== 'conversations' && 'saveToDialog');
                return $dialog;
            });
        }

        return false;
    };

    /**
     * Save As dialog show
     * @param {Object} node     The node to save AS
     * @param {String} content  Content to be saved
     * @param {Function} cb     a callback to be called when the user "Save"
     * @returns {Object}        The jquery object of the dialog
     */
    global.openSaveAsDialog = function(node, content, cb) {
        if (!isUserAllowedToOpenDialogs()) {
            return false;
        }

        // Not allowed chats
        M.safeShowDialog('saveAs', function() {
            const ltWSpaceWarning = new InputFloatWarning($dialog);
            ltWSpaceWarning.hide();

            $.saveAsCallBack = cb;
            $.nodeSaveAs = typeof node === 'string' ? M.d[node] : node;
            $.saveAsContent = content;
            handleOpenDialog(null, node.p || M.RootID);
            return $dialog;
        });

        return false;
    };

    /**
     * A version of the select a folder dialog used for "New Shared Folder" in out-shares.
     * @global
     */
    global.openNewSharedFolderDialog = async function openNewSharedFolderDialog() {
        const target = await selectFolderDialog().catch(dump);
        if (target) {
            M.addSelectedNodes(target);
            return M.openSharingDialog(target);
        }
    };

    /**
     * A version of the select a folder dialog used for selecting target folder
     * @global
     * @param {String} [dialogName] Dialog name (copy, move, share, save, etc)
     * @param {String|Object} [mode] dialog mode (share, save, etc)
     * @param {String} [target] initial target folder, M.RootID by default.
     * @returns {Object} The jquery object of the dialog
     */
    global.selectFolderDialog = function(dialogName = 'selectFolder', mode = false, target = null) {
        return new Promise((resolve, reject) => {
            if (!isUserAllowedToOpenDialogs()) {
                return resolve(null);
            }

            const dsp = () => {
                const res = tryCatch(() => {
                    if (dialogName === 'selectFolder') {
                        M.clearSelectedNodes();
                    }
                    handleOpenDialog(0, target || M.RootID, mode);

                    $.selectFolderCallback = (target) => {
                        $dialog.off('dialog-closed.sfd');
                        delete $.selectFolderCallback;

                        // fulfill with null if dialog was closed/canceled
                        resolve(target || null);
                    };
                    return $dialog.rebind('dialog-closed.sfd', () => $.selectFolderCallback());
                }, reject)();

                assert(res, '[selectFolderDialog] caught exception');
                return res;
            };

            M.safeShowDialog(dialogName, dsp);
        });
    };

    /**
     * A version of the select a folder dialog used for "New File Request Folder" in out-shares.
     * @global
     * @param {Object} options Additional settings for new file request dialog
     * @returns {Object} The jquery object of the dialog
     */
    global.openNewFileRequestDialog = async function(target, options = false) {
        return selectFolderDialog('selectFolder', options.mode || options || 'fileRequestNew', target).catch(dump);
    };

    mBroadcaster.addListener('fm:initialized', function copyMoveDialogs() {
        if (folderlink) {
            return false;
        }

        $dialog = $('.mega-dialog.fm-picker-dialog');
        var $btn = $('.dialog-picker-button', $dialog);
        var $swm = $('.shared-with-me', $dialog);
        var dialogTooltipTimer;

        var treePanelHeader = document.querySelector('.fm-picker-dialog-panel-header');
        $('.fm-picker-dialog-tree-panel', $dialog).each(function(i, elm) {
            elm.insertBefore(treePanelHeader.cloneNode(true), elm.firstElementChild);
        });
        treePanelHeader.parentNode.removeChild(treePanelHeader);

        // dialog sort
        $dialog.find('.fm-picker-dialog-panel-header').append($('.dialog-sorting-menu.hidden').clone());

        $('.fm-picker-dialog-tree-panel.conversations .item-names', $dialog).text(l[17765]);
        $('.fm-picker-dialog-tree-panel.s4 .item-names',  $dialog).text(l.s4_my_buckets);

        // close breadcrumb overflow menu
        $dialog.rebind('click.dialog', e => {
            if (!e.target.closest('.breadcrumb-dropdown, .breadcrumb-dropdown-link') &&
                $('.breadcrumb-dropdown', $dialog).hasClass('active')) {
                $('.breadcrumb-dropdown', $dialog).removeClass('active');
            }
        });

        $('button.js-close, .dialog-cancel-button', $dialog).rebind('click', () => {
            delete $.onImportCopyNodes;
            delete $.albumImport;
            closeDialog();
        });

        $('.fm-picker-dialog-button', $dialog).rebind('click', function _(ev) {
            section = $(this).attr('data-section');

            if (section === 'shared-with-me' && ev !== -0x3f) {
                $('.dialog-content-block', $dialog).empty();
                $('.fm-picker-dialog-button', $dialog).removeClass('active');
                $(this).addClass('active');
                dbfetch.geta(Object.keys(M.c.shares || {}), new MegaPromise())
                    .always(function() {
                        if (section === 'shared-with-me') {
                            _.call(this, -0x3f);
                        }
                    }.bind(this));
                return false;
            }

            treesearch = false;
            handleDialogContent(section);
            $('.search-bar input', $dialog).val('');
            $('.search-bar.placeholder .search-icon-reset', $dialog).addClass('hidden');
            $('.nw-fm-tree-item', $dialog).removeClass('selected');

            if ($.copyToShare) {
                setDialogBreadcrumb();
            }
            else if (section === 'cloud-drive' || section === 'folder-link') {
                setDialogBreadcrumb(M.RootID);
            }
            else if (section === 's4' && 'utils' in s4) {
                const cn = s4.utils.getContainersList();

                // Select MEGA container handle if it's the only one
                setDialogBreadcrumb(cn.length === 1 && cn[0].h || undefined);
            }
            else if (section === 'rubbish-bin') {
                setDialogBreadcrumb(M.RubbishID);
            }
            else {
                setDialogBreadcrumb();
            }

            setDialogButtonState($btn);
        });

        /**
         * On click, copy dialog, dialog-sorting-menu will be shown.
         * Handles that valid informations about current sorting options
         * for selected tab of copy dialog are up to date.
         */
        $('.fm-picker-dialog-panel-arrows', $dialog).rebind('click', function() {
            var $self = $(this);

            if (!$self.hasClass('active')) {
                // There are four menus for each tab: get menu for active tab
                var $menu = $self.siblings('.dialog-sorting-menu');

                var p = $self.position();

                $menu.css('left', p.left + 24 + 'px');
                $menu.css('top', p.top - 8 + 'px');

                // @ToDo: Make sure .by is hadeled properly once when we have chat available

                // Copy dialog key only
                var key = $.dialog[0].toUpperCase() + $.dialog.substr(1) + section;

                $('.dropdown-item', $menu).removeClass('active asc desc');
                $('.sort-arrow', $menu).removeClass('icon-up icon-down');

                const by = escapeHTML(M.sortTreePanel[key] && M.sortTreePanel[key].by || 'name');
                const dir = M.sortTreePanel[key] && M.sortTreePanel[key].dir || 1;

                var $sortbutton = $('.dropdown-item[data-by="' + by + '"]', $menu);

                $sortbutton.addClass(dir > 0 ? 'asc' : 'desc').addClass('active');
                $('.sort-arrow', $sortbutton).addClass(dir > 0 ? 'icon-up' : 'icon-down');

                $self.addClass('active');
                $dialog.find('.dialog-sorting-menu').removeClass('hidden');
            }
            else {
                $self.removeClass('active');
                $dialog.find('.dialog-sorting-menu').addClass('hidden');
            }
        });

        $('.dialog-sorting-menu .dropdown-item', $dialog).rebind('click', function() {
            var $self = $(this);

            // Arbitrary element data
            var data = $self.data();
            var key = $.dialog[0].toUpperCase() + $.dialog.substr(1) + section;
            var $arrowIcon = $('.sort-arrow', $self).removeClass('icon-down icon-up');
            var sortDir;

            if (data.by) {
                M.sortTreePanel[key].by = data.by;
            }

            $self.removeClass('asc desc');



            if ($self.hasClass('active')) {
                M.sortTreePanel[key].dir *= -1;
                sortDir = M.sortTreePanel[key].dir > 0 ? 'asc' : 'desc';
                $self.addClass(sortDir);
            }

            buildDialogTree();

            // Disable previously selected
            $('.sorting-menu-item', $self.parent()).removeClass('active');
            $('.sort-arrow', $self.parent()).removeClass('icon-down icon-up');
            $self.addClass('active');

            // Change icon
            $arrowIcon.addClass(sortDir === 'asc' ? 'icon-up' : 'icon-down');

            // Hide menu
            $('.dialog-sorting-menu', $dialog).addClass('hidden');
            $('.fm-picker-dialog-panel-arrows.active').removeClass('active');
        });

        $('.search-bar input', $dialog).rebind('keyup.dsb', function(ev) {
            var value = String($(this).val()).toLowerCase();
            var exit = ev.keyCode === 27 || !value;
            if (value) {
                $('.search-bar.placeholder .search-icon-reset', $dialog).removeClass('hidden');
            }
            else {
                $('.search-bar.placeholder .search-icon-reset', $dialog).addClass('hidden');
            }
            if (section === 'conversations') {
                var $lis = $('.nw-contact-item', $dialog).parent();

                if (exit) {
                    $lis.removeClass('tree-item-on-search-hidden');
                    if (value) {
                        $(this).val('').trigger("blur");
                    }
                }
                else {
                    $lis.addClass('tree-item-on-search-hidden').each(function(i, elm) {
                        var sel = ['.nw-contact-name', '.nw-contact-email'];
                        for (i = sel.length; i--;) {
                            var tmp = elm.querySelector(sel[i]);
                            if (tmp) {
                                tmp = String(tmp.textContent).toLowerCase();

                                if (tmp.indexOf(value) !== -1) {
                                    elm.classList.remove('tree-item-on-search-hidden');
                                    break;
                                }
                            }
                        }
                    });
                }

                onIdle(function() {
                    initPerfectScrollbar($('.right-pane.active .dialog-tree-panel-scroll', $dialog));
                });
            }
            else {
                if (exit) {
                    treesearch = false;
                    if (value) {
                        $(this).val('').trigger("blur");
                    }
                }
                else {
                    treesearch = value;
                }

                delay('mctree:search', buildDialogTree);
            }

            return false;
        });

        $('.search-bar.placeholder .search-icon-reset', $dialog).rebind('click.dsb', () => {
            $('.search-bar input', $dialog).val('').trigger('keyup.dsb');
        });

        $('.dialog-newfolder-button', $dialog).rebind('click', function() {
            $dialog.addClass('arrange-to-back');

            $.cfsection = section;
            $.cftarget = $.mcselected || (section === 'cloud-drive' ? M.RootID : M.RubbishID);

            const callback = (h) => {
                // Auto-select the created folder.
                const p = Object(M.d[h]).p || $.cftarget;

                // Refresh list (moved from sc-parser)
                refreshDialogContent();

                // Make sure parent has selected class to make it expand
                $(`#mctreea_${p}`, $dialog).addClass('selected');
                selectTreeItem(p);
                selectTreeItem(h);
            };

            const target = $.mcselected || (section === 'cloud-drive' ? M.RootID : M.RubbishID);
            const node = M.getNodeByHandle(target);

            if ('kernel' in s4 && node.s4 && s4.kernel.getS4NodeType(node) === 'container') {
                return s4.ui.showDialog(s4.buckets.dialogs.create, target, callback);
            }

            $.cftarget = target;
            ($.cfpromise = mega.promise)
                .then((h) => callback(h))
                .catch(nop);

            createFolderDialog();

            $('.mega-dialog.create-folder-dialog .create-folder-size-icon').addClass('hidden');
        });

        $('.dialog-newcontact-button', $dialog).rebind('click', function() {
            closeDialog();
            contactAddDialog();
        });

        $dialog.rebind('click', '.nw-contact-item', function() {
            const $this = $(this);
            const $scrollBlock = $('.right-pane.active .dialog-tree-panel-scroll', $dialog);

            if ($this.hasClass('selected')) {
                $this.removeClass('selected');
            }
            else {
                $this.addClass('selected');
            }

            setDialogBreadcrumb();
            setDialogButtonState($btn);
            initPerfectScrollbar($scrollBlock);

            // Scroll the element into view, only needed if element triggered.
            scrollToElement($scrollBlock, $this);
        });

        $dialog.rebind('click', '.nw-fm-tree-item', function(e) {

            var ts = treesearch;
            var old = $.mcselected;
            const $scrollBlock = $('.right-pane.active .dialog-tree-panel-scroll', $dialog);

            setDialogBreadcrumb(String($(this).attr('id')).replace('mctreea_', ''));

            treesearch = false;
            M.buildtree({h: $.mcselected}, 'fm-picker-dialog', section);
            treesearch = ts;
            disableFolders();

            var c = $(e.target).attr('class');

            // Sub-folder exist?
            if (c && c.indexOf('nw-fm-tree-arrow') > -1) {

                c = $(this).attr('class');

                // Sub-folder expanded
                if (c && c.indexOf('expanded') > -1) {
                    $(this).removeClass('expanded');
                    $('#mctreesub_' + $.mcselected).removeClass('opened');
                }
                else {
                    $(this).addClass('expanded');
                    $('#mctreesub_' + $.mcselected).addClass('opened');
                }
            }
            else {

                c = $(this).attr('class');

                if (c && c.indexOf('selected') > -1) {
                    if (c && c.indexOf('expanded') > -1) {
                        $(this).removeClass('expanded');
                        $('#mctreesub_' + $.mcselected).removeClass('opened');
                    }
                    else {
                        $(this).addClass('expanded');
                        $('#mctreesub_' + $.mcselected).addClass('opened');
                    }
                }
            }

            if (!$(this).is('.disabled')) {
                // unselect previously selected item
                $('.nw-fm-tree-item', $dialog).removeClass('selected');
                $(this).addClass('selected');
                $btn.removeClass('disabled');
            }
            else if ($('#mctreea_' + old + ':visible').length) {
                setDialogBreadcrumb(old);
                $('#mctreea_' + old).addClass('selected');
            }
            else {
                setDialogBreadcrumb();
            }

            initPerfectScrollbar($scrollBlock);

            // Disable action button if there is no selected items
            setDialogButtonState($btn);

            // Set opened & expanded ancestors, only needed if element triggered.
            $(this).parentsUntil('.dialog-content-block', 'ul').addClass('opened')
                .prev('.nw-fm-tree-item').addClass('expanded');

            // Scroll the element into view, only needed if element triggered.
            scrollToElement($scrollBlock, $(this));

            // // If not copying from contacts tab (Ie, sharing)
            if (!(section === 'cloud-drive' && (M.currentrootid === 'chat' || $.copyToShare))) {
                if ($.mcselected && M.getNodeRights($.mcselected) > 0) {
                    $('.dialog-newfolder-button', $dialog).removeClass('hidden');
                }
                else {
                    $('.dialog-newfolder-button', $dialog).addClass('hidden');
                }
            }
        });

        $swm.rebind('mouseenter', '.nw-fm-tree-item', function _try(ev) {
            var h = $(this).attr('id').replace('mctreea_', '');

            if (ev !== 0xEFAEE && !M.c[h]) {
                var self = this;
                dbfetch.get(h).always(function() {
                    _try.call(self, 0xEFAEE);
                });
                return false;
            }

            var share = shares[h];
            var owner = share && share.owner;
            var user = M.getUserByHandle(owner);

            if (!user) {
                return false;
            }

            var $item = $('.nw-fm-tree-folder, .nw-fm-tree-icon-wrap', $(this));
            var itemLeftPos = $item.offset().left;
            var itemTopPos = $item.offset().top;
            var $tooltip = $('.contact-preview', $dialog);
            var avatar = useravatar.contact(owner, '', 'div');
            var note = !share.level && !share.circular && l[19340];
            var displayName = user.nickname || user.name || user.m;

            $tooltip.find('.contacts-info.body')
                .safeHTML(
                    '<div class="user-card-wrap">' +
                    avatar +
                    '<div class="user-card-data no-status">' +
                    '  <div class="user-card-name small selectable-txt">@@<span class="grey">(@@)</span></div>' +
                    '  <div class="user-card-email selectable-txt small">@@</div>' +
                    '</div>' +
                    '</div>' +
                    ' <div class="user-card-email selectable-txt small @@">@@</div>',
                    displayName || '', l[8664], user.m || '', note ? 'note' : '', note || ''
                );

            clearTimeout(dialogTooltipTimer);
            dialogTooltipTimer = setTimeout(function() {
                $tooltip.removeClass('hidden');
                $tooltip.css({
                    'left': itemLeftPos + $item.outerWidth() / 2 - $tooltip.outerWidth() / 2 + 'px',
                    'top': (itemTopPos - (note ? 120 : 75)) + 'px'
                });
            }, 200);

            return false;
        });

        $swm.rebind('mouseleave', '.nw-fm-tree-item', function() {

            var $tooltip = $('.contact-preview', $dialog);

            clearTimeout(dialogTooltipTimer);
            $tooltip.hide();

            return false;
        });

        // Handle conversations tab item selection
        $dialog.rebind('click', '.nw-conversations-item', function() {

            setDialogBreadcrumb(String($(this).attr('id')).replace('contact2_', ''));

            // unselect previously selected item
            $('.nw-conversations-item', $dialog).removeClass('selected');
            $(this).addClass('selected');
            $btn.removeClass('disabled');

            // Disable action button if there is no selected items
            setDialogButtonState($btn);
        });

        // Handle copy/move/share button action
        $btn.rebind('click', function() {
            var chats = getSelectedChats();
            var skip = !$.mcselected && section !== 'conversations';

            if (skip || $(this).hasClass('disabled')) {
                return false;
            }
            let selectedNodes = [];
            if (Array.isArray($.selected)) {
                selectedNodes = [...$.selected];
            }

            // closeDialog would cleanup some $.* variables, so we need them cloned here
            const {
                saveToDialogCb,
                saveToDialogNode,
                shareToContactId,
                noOpenChatFromPreview
            } = $;
            const saveToDialog = $.saveToDialog || saveToDialogNode;

            delete $.saveToDialogPromise;
            delete $.noOpenChatFromPreview;

            if ($.copyToUpload) {
                var data = $.copyToUpload;
                var target = $.mcselected;

                if (section === 'conversations') {
                    target = chats.map(function(h) {
                        if (megaChat.chats[h]) {
                            return megaChat.chats[h].getRoomUrl().replace("fm/", "");
                        } else if (M.u[h]) {
                            return 'chat/p/' + h;
                        }
                        else {
                            if (d) {
                                console.error("Chat room not found for handle:", h);
                            }
                            return '';
                        }
                    });
                }

                if ($('.notagain', $dialog).prop('checked')) {
                    mega.config.setn('ulddd', 1);
                }

                closeDialog();
                M.addUpload(data[0], false, data[1], target);
                return false;
            }

            if ($.selectFolderCallback) {
                tryCatch(() => $.selectFolderCallback($.mcselected))();
                delete $.selectFolderCallback;
                closeDialog();
                return false;
            }

            if ($.moveDialog) {
                if (section === "shared-with-me") {
                    var $tooltip = $('.contact-preview', $dialog);
                    clearTimeout(dialogTooltipTimer);
                    $tooltip.hide();
                }
                closeDialog();
                mLoadingSpinner.show('safeMoveNodes');
                M.safeMoveNodes($.mcselected).catch(dump).finally(() => mLoadingSpinner.hide('safeMoveNodes'));
                return false;
            }

            if ($.nodeSaveAs) {
                var $nameInput = $('#f-name-input', $dialog);
                var saveAsName = $nameInput.val();
                var eventName = 'input.saveas';

                var removeErrorStyling = function() {
                    $nameInput.removeClass('error');
                    $dialog.removeClass('duplicate');
                    $nameInput.off(eventName);
                };

                removeErrorStyling();

                var errMsg = '';

                if (!saveAsName.trim()) {
                    errMsg = l[5744];
                }
                else if (!M.isSafeName(saveAsName)) {
                    errMsg = saveAsName.length > 250 ? l.LongName1 : l[24708];
                }
                else if (duplicated(saveAsName, $.mcselected)) {
                    errMsg = l[23219];
                }

                if (errMsg) {
                    $('.duplicated-input-warning span', $dialog).text(errMsg);
                    $dialog.addClass('duplicate');
                    $nameInput.addClass('error');

                    $nameInput.rebind(eventName, function() {
                        removeErrorStyling();
                        return false;
                    });

                    setTimeout(() => {
                        removeErrorStyling();
                    }, 2000);

                    return false;
                }

                $nameInput.rebind(eventName, function() {
                    removeErrorStyling();
                    return false;
                });

                $nameInput.off(eventName);

                var nodeToSave = $.nodeSaveAs;
                closeDialog();

                M.getStorageQuota().then(data => {
                    if (data.isFull) {
                        ulmanager.ulShowOverStorageQuotaDialog();
                        return false;
                    }

                    mega.fileTextEditor.saveFileAs(saveAsName, $.mcselected, $.saveAsContent, nodeToSave)
                        .then($.saveAsCallBack || nop)
                        .catch(tell);
                });

                return false;
            }

            closeDialog();

            if (saveToDialog) {
                saveToDialogCb(saveToDialogNode, section === 'conversations' && chats || $.mcselected);
                return false;
            }

            // Get active tab
            if (section === 'cloud-drive' || section === 'folder-link'
                || section === 'rubbish-bin' || section === 's4') {

                // If copying from contacts tab (Ie, sharing)
                if ($(this).text().trim() === l[1344]) {
                    var user = {
                        u: shareToContactId ? shareToContactId : M.currentdirid
                    };
                    var spValue = $('.permissions.dropdown-input', $dialog).attr('data-access');
                    if (spValue === 'read-and-write') {
                        user.r = 1;
                    }
                    else if (spValue === 'full-access') {
                        user.r = 2;
                    }
                    else {
                        user.r = 0;
                    }
                    const target = $.mcselected;
                    mega.keyMgr.setShareSnapshot(target)
                        .then(() => doShare(target, [user]))
                        .catch(tell);
                }
                else if ($.albumImport) {
                    // This is a set to be imported
                    mega.sets.copyNodesAndSet(selectedNodes, $.mcselected)
                        .catch((ex) => {
                            if (ex === EBLOCKED) {
                                // Album link import failed (quota, ...)
                                eventlog(99955);
                            }
                            else {
                                tell(ex);
                            }
                        });
                }
                else {
                    M.copyNodes(selectedNodes, $.mcselected)
                        .catch((ex) => ex !== EBLOCKED && tell(ex));
                }
            }
            else if (section === 'shared-with-me') {
                M.copyNodes(getNonCircularNodes(selectedNodes), $.mcselected).catch(tell);
            }
            else if (section === 'conversations') {
                if (window.megaChatIsReady) {

                    megaChat.openChatAndAttachNodes(chats, selectedNodes, !!noOpenChatFromPreview).dump('attach');
                }
                else if (d) {
                    console.error('MEGAchat is not ready');
                }

            }

            delete $.onImportCopyNodes;

            return false;
        });

        return 0xDEAD;
    });

})(self);

/**
 * bindDropdownEvents Bind custom select event
 *
 * @param {Selector} $select  Class .dropdown elements selector
 * @param {String}   saveOption Addition option for account page only. Allows to show "Show changes" notification
 * @param {String}   classname/id of  content block for dropdown aligment
 */
function bindDropdownEvents($select, saveOption, contentBlock) {
    'use strict';

    var $dropdownItem = $('.option', $select);
    var $contentBlock = contentBlock ? $(contentBlock) : $('body');
    var $hiddenInput = $('.hidden-input', $select);

    // hidden input for keyboard search
    if (!$hiddenInput.length) {

        // Skip tab action for hidden input by tabindex="-1"
        $select.safeAppend('<input class="hidden-input" tabindex="-1" autocomplete="disabled">');
        $hiddenInput = $('input.hidden-input', $select);
    }

    $select.rebind('click.inputDropdown', function(e) {

        var $this = $(this);
        var $dropdown = $('.mega-input-dropdown', $this);
        var $hiddenInput = $('.hidden-input', $this);
        var $target = $(e.target);

        var closeDropdown = function() {
            $this.removeClass('active');
            $dropdown.addClass('hidden').removeAttr('style');
            $contentBlock.unbind('mousedown.closeInputDropdown');
            $hiddenInput.trigger('blur');
        };

        if ($this.hasClass('disabled')) {
            return false;
        }
        else if (!$this.hasClass('active')) {

            var horizontalOffset;
            var verticalOffset;
            var dropdownLeftPos;
            var dropdownBottPos;
            var dropdownHeight;
            var dropdownWidth;
            var contentBlockHeight;
            var contentBlockWidth;
            var $activeDropdownItem = $('.option[data-state="active"]', $dropdown);

            // Show select dropdown
            $('.mega-input.dropdown-input.active', 'body').removeClass('active');
            $('.active .mega-input-dropdown', 'body').addClass('hidden');
            $this.addClass('active');
            $('.option.active', $this).removeClass('active');
            $activeDropdownItem.addClass('active');
            $dropdown.removeClass('hidden');

            // For case select is located under overflow none element, to avoid it is hidden under overflow
            if ($this.closest('.ps').length) {

                $dropdown.css('min-width', $this.width() + 18);

                $dropdown.position({
                    of: $this,
                    my: 'left-9 top-7',
                    at: 'left top',
                    collision: 'flipfit'
                });
            }

            $hiddenInput.trigger('focus');

            // Dropdown position relative to the window
            horizontalOffset = $dropdown.offset().left - $contentBlock.offset().left;
            verticalOffset = $dropdown.offset().top - $contentBlock.offset().top;
            contentBlockHeight = $contentBlock.outerHeight();
            contentBlockWidth = $contentBlock.outerWidth();
            dropdownHeight = $dropdown.outerHeight();
            dropdownWidth = $dropdown.outerWidth();
            dropdownBottPos = contentBlockHeight - (verticalOffset + dropdownHeight);
            dropdownLeftPos = contentBlockWidth - (horizontalOffset + dropdownWidth);

            if (contentBlockHeight < (dropdownHeight + 20)) {
                $dropdown.css({
                    'margin-top': '-' + (verticalOffset - 10) + 'px',
                    'height': (contentBlockHeight - 20) + 'px'
                });
            }
            else if (dropdownBottPos < 10) {
                $dropdown.css({
                    'margin-top': '-' + (10 - dropdownBottPos) + 'px'
                });
            }

            if (dropdownLeftPos < 20) {
                $dropdown.css({
                    'margin-left': '-' + (10 - dropdownLeftPos) + 'px'
                });
            }

            $contentBlock.rebind('mousedown.closeInputDropdown', e => {
                var $target = $(e.target);

                if (!$this.has($target).length && !$this.is($target)) {

                    closeDropdown();
                }
            });
            var $scrollBlock = $('.dropdown-scroll', $this);

            // Dropdown scrolling initialization
            if ($scrollBlock.length) {
                if ($scrollBlock.is('.ps')) {
                    $scrollBlock.scrollTop(0);
                    Ps.destroy($scrollBlock[0]);
                }

                Ps.initialize($scrollBlock[0]);

                if ($activeDropdownItem.length) {
                    $scrollBlock.scrollTop($activeDropdownItem.position().top);
                }
            }

            $hiddenInput.trigger('focus');
        }
        else if (($target.closest('.option').length || $target.is('.option'))
            && !($target.hasClass('disabled') || $target.closest('.option').hasClass('disabled'))) {
            closeDropdown();
        }
    });

    $dropdownItem.rebind('click.inputDropdown', function() {

        var $this = $(this);

        $select.removeClass('error');

        // Select dropdown item
        $('.option', $select).removeClass('active').removeAttr('data-state');
        $this.addClass('active').attr('data-state', 'active');
        $('> span', $select).text($this.text());
        $('> span', $select).removeClass('placeholder');
        $this.trigger('change');

        if (saveOption) {
            var nameLen = String($('#account-firstname').val() || '').trim().length;

            // Save changes for account page
            if (nameLen) {
                $('.save-block', $this.closest('.settings-right-block')).removeClass('hidden');
            }
        }
    });

    $dropdownItem.rebind('mouseenter.inputDropdown', function() {

        var $this = $(this);

        // If contents width is bigger than size of dropdown
        if (this.offsetWidth < this.scrollWidth) {
            $this.addClass('simpletip').attr('data-simpletip', $this.text());
        }
    });

    // Typing search and arrow key up and down features for dropdowns
    $hiddenInput.rebind('keyup.inputDropdown', function(e) {
        var charCode = e.which || e.keyCode; // ff
        var $filteredItem = {};

        if ((charCode > 64 && charCode < 91) || (charCode > 96 && charCode < 123)) {
            var inputValue = $hiddenInput.val();

            $filteredItem = $dropdownItem.filter(function() {
                return $(this).text().slice(0, inputValue.length).toLowerCase() === inputValue.toLowerCase();
            }).first();
        }
        else {
            e.preventDefault();
            e.stopPropagation();

            const $activeOption = $('.option.active', $select);
            const $current = $activeOption.length ? $activeOption :
                $('.option:not(.template)', $select).first();

            var $prev = $current.prev('.option:not(.template)');
            var $next = $current.next('.option:not(.template)');

            if (charCode === 38 && $prev.length) { // Up key
                $filteredItem = $prev;
            }
            else if (charCode === 40 && $next.length) { // Down key
                $filteredItem = $next;
            }
            else if (charCode === 13) {// Enter
                $current.trigger('click');
            }
        }

        if ($filteredItem.length) {
            const $dropdownScroll = $('.dropdown-scroll', this);
            const $scrollBlock = $dropdownScroll.length ? $dropdownScroll :
                $('.dropdown-scroll', $(this).closest('.dropdown-input'));

            $('.option.active', $select).removeClass('active');
            $filteredItem.addClass('active');

            if ($scrollBlock.length) {
                $scrollBlock.scrollTop($scrollBlock.scrollTop() + $filteredItem.position().top);
            }
        }
    });

    $hiddenInput.rebind('keydown.inputDropdown', function() {
        var $this = $(this);

        delay('dropbox:clearHidden', () => {
            // Combination language bug fixs for MacOS.
            $this.val('').trigger('blur').trigger('focus');
        }, 750);
    });
    // End of typing search for dropdowns
}

/**
 * addToMultiInputDropDownList
 *
 * Add item from token.input plugin drop down list.
 *
 * @param {String} dialog, The class name.
 * @param {Array} item An array of JSON objects e.g. { id, name }.
 *
 */
function addToMultiInputDropDownList(dialog, item) {

    'use strict';

    if (dialog) {
        $(dialog).tokenInput("addToDDL", item);
    }
}

/**
 * removeFromMultiInputDDL
 *
 * Remove item from token.input plugin drop down list.
 *
 * @param {String} dialog, The class name.
 * @param {Array} item An array of JSON objects e.g. { id, name }.
 *
 */
function removeFromMultiInputDDL(dialog, item) {

    'use strict';

    if (dialog) {
        $(dialog).tokenInput("removeFromDDL", item);
    }
}

/**
 * Set mega dropdown value
 *
 * @param {$} $container parent or element selctor
 * @param {string|function} selectedOptionCallback value or callback to get selected option element
 *
 * @returns {void}
 */
function setDropdownValue($container, selectedOptionCallback) {
    'use strict';

    const $megaInputDropdown = getDropdownMegaInput($container);
    if (!$megaInputDropdown || !$megaInputDropdown.length) {
        return;
    }

    const $dropdownInput = $('.mega-input-dropdown',  $megaInputDropdown);
    const $dropdownInputOptions = $('.option', $dropdownInput);

    if (!$dropdownInputOptions.length) {
        return;
    }

    let $selectedOption = typeof selectedOptionCallback === 'function' ?
        selectedOptionCallback($dropdownInput, $dropdownInputOptions) :
        $(`.option[data-value="${selectedOptionCallback}"]`, $dropdownInput);

    const $dropdownSpanValueLabel = $('span:first', $megaInputDropdown);
    const $dropdownHiddenInput = $('.hidden-input', $megaInputDropdown);

    // Clear selected value;
    $dropdownInputOptions
        .removeClass('active')
        .removeAttr('data-state');

    if (!$selectedOption.length) {
        $selectedOption = $dropdownInputOptions.first(); // If no match then select first by default?
    }

    if (!$selectedOption.length) { // Abnormal situation, dropdown may not be initialized
        return;
    }

    $selectedOption
        .addClass('active')
        .attr('data-state', 'active');

    $dropdownSpanValueLabel.text($selectedOption.text());
    $dropdownHiddenInput.trigger('focus');
}

function getDropdownMegaInput($container) {
    'use strict';
    if (!$container || !$container.length) {
        return;
    }

    const inputDropdownClass = 'dropdown-input';
    const megaInputClass = 'mega-input';
    const dropdownClass = `.${megaInputClass}.${inputDropdownClass}`;

    let $megaInputDropdown = $container;

    if (!$megaInputDropdown.hasClass(megaInputClass) && !$megaInputDropdown.hasClass(inputDropdownClass)) {
        $megaInputDropdown = $container.closest(dropdownClass);
    }

    return $megaInputDropdown;
}

function createDropdown($container, options) {
    'use strict';

    const $megaInputDropdown = getDropdownMegaInput($container);
    if (!$megaInputDropdown || !$megaInputDropdown.length) {
        return;
    }

    const __prepareDropdownLabel = ($megaInputDropdown, options) => {
        const $dropdownTitle = $('.mega-input-title', $megaInputDropdown);
        const $dropdownInput = $('.mega-input-dropdown',  $megaInputDropdown);
        let $dropdownSpanValueLabel = $('span:first', $megaInputDropdown);

        if (!$dropdownSpanValueLabel.length) {
            $dropdownSpanValueLabel = $('<span/>', {});

            if ($dropdownTitle.length) {
                $dropdownSpanValueLabel.insertAfter($dropdownTitle);
            }
            else {
                $dropdownSpanValueLabel.insertBefore($dropdownInput);
            }
        }

        if (typeof options.placeholder === 'string') {
            $dropdownSpanValueLabel.text(options.placeholder);
        }
    };

    const __prepareDropdownOptions = ($megaInputDropdown, $dropdownInput, options) => {
        const $dropdownInputScroll = $('.dropdown-scroll',  $dropdownInput);
        if ($dropdownInputScroll.length) {
            $dropdownInputScroll.empty(); // clear list
        }

        const selectedOption = options.selected;
        const selectedOptionCallback = typeof selectedOption === 'function' ?
            selectedOption :
            null;

        const postActionCallback = typeof options.postAction === 'function' ?
            options.postAction :
            null;

        const optionList = options.items;

        if (typeof optionList !== 'object') {
            return;
        }

        let $selectedOption  = null;

        for (const option in optionList) {
            if (!optionList.hasOwnProperty(option)) {
                continue;
            }

            const value = optionList[option];
            const index = option;
            const attr = {
                'data-value': index
            };

            const $dropdownOptionItem = $(
                '<div/>', {
                    class: 'option'
                }
            );

            $dropdownOptionItem
                .attr(attr)
                .text(value);

            if (selectedOption) {
                const result =  selectedOptionCallback ?
                    selectedOptionCallback($dropdownOptionItem, value, index) :
                    selectedOption === index;

                if (result) {
                    $dropdownOptionItem
                        .addClass('active')
                        .attr('data-state', 'active');

                    $selectedOption = $dropdownOptionItem;
                }
            }

            if (postActionCallback) {
                postActionCallback($dropdownOptionItem, value, index, optionList);
            }

            $dropdownOptionItem.appendTo($dropdownInputScroll);
        }

        const $dropdownSpanValueLabel = $('span:first', $megaInputDropdown);
        const $dropdownHiddenInput = $('.hidden-input', $megaInputDropdown);

        if (!$selectedOption || !$selectedOption.length) { // Abnormal situation, dropdown may not be initialized
            return;
        }

        $dropdownSpanValueLabel.text($selectedOption.text());
        $dropdownHiddenInput.trigger('focus');
    };

    __prepareDropdownLabel($megaInputDropdown, options);

    const $dropdownInput = $('.mega-input-dropdown',  $megaInputDropdown);
    __prepareDropdownOptions($megaInputDropdown, $dropdownInput, options);
}

function getDropdownValue($container, attributeName) {
    'use strict';

    const defaultValue = '';
    const $megaInputDropdown = getDropdownMegaInput($container);
    if (!$megaInputDropdown || !$megaInputDropdown.length) {
        return defaultValue;
    }

    const $dropdownInput = $('.mega-input-dropdown ',  $megaInputDropdown);
    if (!$dropdownInput.length) {
        return defaultValue;
    }

    const $dropdownInputSelectedOption = $(`.option[data-state="active"]`, $dropdownInput);
    if (!$dropdownInputSelectedOption.length) {
        return defaultValue;
    }

    if (!attributeName) {
        return $dropdownInputSelectedOption.attr('data-value') ||
            defaultValue;
    }

    return $dropdownInputSelectedOption.attr(`data-${attributeName}`) ||
        $dropdownInputSelectedOption.attr('data-value') ||
        defaultValue;
}

/** @property mega.ui.mNodeFilter */
lazy(mega.ui, 'mNodeFilter', () => {
    'use strict';

    // DOM caches
    const $filterChipsWrapper = $('.fm-filter-chips-wrapper');
    const $filterChips = $('.fm-filter-chips', $filterChipsWrapper);
    const $resetFilterChips = $('.fm-filter-reset', $filterChips);

    // For modified date calculation, use today's date
    const today = new Date();
    const currentYearStart = new Date(today.getFullYear(), 0, 1);
    const lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
    const lastYearEnd =  new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59);

    // static sections where we don't show filtering capabilities
    const hiddenSections = new Set([
        'shares', 'out-shares', 'file-requests', 'faves', 'recents'
    ]);

    // filtering bitfield
    let selectedFilters = 0;

    // Available filters
    const filters = {
        type: {
            title: l.filter_chip_type,
            selection: false,
            eid: 99941,
            match(n) {
                if (n.t) {
                    return this.selection.includes('folder');
                }

                const fext = fileext(n.name, false, true);
                if (!fext) {
                    return false;
                }

                if (this.selection.includes('other')) {
                    if (!this.types) {
                        this.types = this.menu.map(e => e.data).filter(Boolean).flat();
                    }
                    return !ext[fext] || !this.types.includes(ext[fext][0]);
                }

                return ext[fext] && this.selection.includes(ext[fext][0]);
            },
            menu: [
                {
                    icon: 'recents',
                    label: l.filter_chip_type_all,
                    data: null,
                    eid: 99942
                },
                {
                    icon: 'images',
                    label: l.filter_chip_type_images,
                    data: ['image'],
                    eid: 99943
                },
                {
                    icon: 'file',
                    label: l.filter_chip_type_documents,
                    data: ['word', 'text'],
                    eid: 99944
                },
                {
                    icon: 'audio-filled',
                    label: l.filter_chip_type_audio,
                    data: ['audio'],
                    eid: 99945
                },
                {
                    icon: 'videos',
                    label: l.filter_chip_type_video,
                    data: ['video'],
                    eid: 99946
                },
                {
                    icon: 'file',
                    label: l.filter_chip_type_pdf,
                    data: ['pdf'],
                    eid: 99947
                },
                {
                    icon: 'play-square',
                    label: l.filter_chip_type_presentation,
                    data: ['powerpoint'],
                    eid: 99948
                },
                {
                    icon: 'view-medium-list',
                    label: l.filter_chip_type_spreadsheets,
                    data: ['spreadsheet', 'excel'],
                    eid: 99949
                },
                {
                    icon: 'folder',
                    label: l.filter_chip_type_folder,
                    data: ['folder'],
                    eid: 99950
                },
                {
                    icon: 'question-filled',
                    label: l.filter_chip_type_other,
                    data: ['other'],
                    eid: 99951
                },
            ]
        },

        mtime: {
            title: l.filter_chip_mdate,
            selection: false,
            eid: 99953,
            match(n) {
                const nodeMtime = (n.mtime || n.ts) * 1000;

                // Date range
                if (this.selection && this.selection.min && this.selection.max) {
                    return nodeMtime >= this.selection.min && nodeMtime <= this.selection.max;
                }

                return this.selection < 0 ? nodeMtime < lastYearStart : nodeMtime >= this.selection;
            },
            menu: [
                {
                    eid: 99957,
                    label: l.filter_chip_mdate_today,
                    get data() {
                        // Set hours to 12am today
                        return new Date().setHours(0, 0 ,0 ,0);
                    }
                },
                {
                    eid: 99958,
                    label: l.filter_chip_mdate_seven,
                    get data() {
                        return new Date().setDate(today.getDate() - 7);
                    }
                },
                {
                    eid: 99959,
                    label: l.filter_chip_mdate_thirty,
                    get data() {
                        return new Date().setDate(today.getDate() - 30);
                    }
                },
                {
                    eid: 99960,
                    label: l.filter_chip_mdate_year,
                    get data() {
                        return currentYearStart;
                    }
                },
                {
                    eid: 99974,
                    label: l.filter_chip_mdate_lyear,
                    get data() {
                        return  {
                            min: lastYearStart,
                            max: lastYearEnd
                        };
                    }
                },
                {
                    eid: 99961,
                    label: l.filter_chip_mdate_older,
                    get data() {
                        return -1;
                    }
                }
            ]
        },

        dateadded: {
            title: l['17445'],
            selection: false,
            eid: 500018,
            match(n) {

                const nodeAddedTime = n.ts * 1000;

                // Date range
                if (this.selection && this.selection.min && this.selection.max) {
                    return nodeAddedTime >= this.selection.min && nodeAddedTime <= this.selection.max;
                }

                return this.selection < 0 ? nodeAddedTime < lastYearStart : nodeAddedTime >= this.selection;
            },
            menu: [
                {
                    eid: 99995,
                    label: l.filter_chip_mdate_today,
                    get data() {
                        // Set hours to 12am today
                        return new Date().setHours(0, 0 ,0 ,0);
                    }
                },
                {
                    eid: 500013,
                    label: l.filter_chip_mdate_seven,
                    get data() {
                        return new Date().setDate(today.getDate() - 7);
                    }
                },
                {
                    eid: 500014,
                    label: l.filter_chip_mdate_thirty,
                    get data() {
                        return new Date().setDate(today.getDate() - 30);
                    }
                },
                {
                    eid: 500015,
                    label: l.filter_chip_mdate_year,
                    get data() {
                        return currentYearStart;
                    }
                },
                {
                    eid: 500017,
                    label: l.filter_chip_mdate_lyear,
                    get data() {
                        return  {
                            min: lastYearStart,
                            max: lastYearEnd
                        };
                    }
                },
                {
                    eid: 500016,
                    label: l.filter_chip_mdate_older,
                    get data() {
                        return -1;
                    }
                }
            ]
        },

        location: {
            title: l['17818'],
            selection: false,
            eid: 99979,
            shouldShow() {
                return !!M.search;
            },
            match(n) {

                // Get root dir name (or handle) e.g. what M.currentrootid would give if in a specific area
                const root = M.getNodeRoot(n.h);

                // Match nodes in Cloud Drive, Favourites, Backups, Rubbish bin, Incoming shares,
                // or Outgoing shares (NB: Outgoing shares (includes the external links - for now)
                if ((this.selection.includes('cloud') && root === M.RootID) ||
                   (this.selection.includes('favourites') && n.fav) ||
                   (this.selection.includes('backups') && n.devid) ||
                   (this.selection.includes('rubbish') && root === M.RubbishID) ||
                   (this.selection.includes('incoming') && root === 'shares') ||
                   (this.selection.includes('outgoing') && n.shares)) {

                    return true;
                }

                // Match recently created (not exactly the same list as fm/recents, could potentially use
                // getRecentActionsList() but it's not loaded before searching so n.recent is not populated)
                if (this.selection.includes('recents')) {

                    const currentTimestamp = unixtime();
                    const recentsThreshold = currentTimestamp - (60 * 60 * 24 * 7 * 12);    // 12 weeks (3 months)

                    // If the created timestamp is more than x weeks ago, include it
                    if (n.ts >= recentsThreshold) {
                        return true;
                    }
                }

                return false;
            },
            menu: [
                {
                    icon: 'mega-thin-solid',
                    label: l.all_mega,
                    data: null,
                    eid: 99980
                },
                {
                    icon: 'cloud-drive',
                    label: l['164'],
                    data: ['cloud'],
                    eid: 99981
                },
                {
                    icon: 'recents-filled',
                    label: l['20141'],
                    data: ['recents'],
                    eid: 99982
                },
                {
                    icon: 'favourite-filled',
                    label: l.gallery_favourites,
                    data: ['favourites'],
                    eid: 99983
                },
                {
                    icon: 'database-filled',
                    label: l.restricted_folder_button,
                    data: ['backups'],
                    eid: 99984
                },
                {
                    icon: 'bin-filled',
                    label: l['168'],
                    data: ['rubbish'],
                    eid: 99985
                },
                {
                    icon: 'folder-incoming-share',
                    label: l['5542'],
                    data: ['incoming'],
                    eid: 99986
                },
                {
                    icon: 'folder-outgoing-share',
                    label: l['5543'],
                    data: ['outgoing'],
                    eid: 99987
                }
            ]
        }
    };
    Object.setPrototypeOf(filters, null);

    /**
     * The filter chip dropdown component
     * @extends MMenuSelect
     */
    class FilterChip extends MMenuSelect {

        /**
         * Create a FilterChip.
         * @param {String} name static filter identifier.
         */
        constructor(name) {
            super(null, ['hide-radio-on']);

            this.$selectedMarkTemplate = $('.selected-mark-template', $filterChipsWrapper);
            this.$element = $(`.fm-filter-chip-${name}`, $filterChipsWrapper);
            this.$text = $('.fm-filter-chip-button-text', this.$element);

            Object.defineProperty(this, 'name', {value: name});
            Object.defineProperty(this, 'ident', {value: 1 << Object.keys(filters).indexOf(name)});
            Object.defineProperty(this, 'ctx', {value: filters[name]});

            // @todo make this 'click' still optional for our purpose in MMenuSelect(?)
            for (let i = this.ctx.menu.length; i--;) {
                this.ctx.menu[i].click = nop;
            }
            this.options = this.ctx.menu;
            this.selectedIndex = -1;

            this.$element.rebind(`click.filterByType${name}`, () => {
                if (this.ctx.eid) {
                    eventlog(this.ctx.eid);
                }

                const {x, bottom} = this.$element.get(0).getBoundingClientRect();
                this.show(x, bottom + 1);

                // If no item has been selected yet, reset to the default state
                if (this.selectedIndex === -1) {
                    this.$text.text(this.ctx.title);
                    this.$element.removeClass('selected');
                }
            });

            $resetFilterChips.rebind(`click.resetFilterBy${name}`, () => this.resetToDefault());
        }

        /**
         * Sets the options for the filter chip and updates the checkmark for each option.
         * @param {Array} list - The list of options
         */
        set options(list) {
            super.options = list;

            for (let i = 0; i < this._options.length; i++) {
                const $checkmark = this.$selectedMarkTemplate.clone();
                $checkmark.removeClass('selected-mark-template hidden');
                $(this._options[i].el).safeAppend($checkmark.prop('outerHTML'));
            }
        }

        /**
         * Resets the filter to its default state.
         *
         * @returns {undefined}
         */
        resetToDefault() {
            this.selectedIndex = -1;

            for (let i = 0; i < this._options.length; i++) {
                this._options[i].deselectItem();
                this._options[i].el.classList.remove('selected');
            }

            selectedFilters &= ~this.ident;

            this.ctx.selection = false;
            this.$text.text(this.ctx.title);
            this.$element.removeClass('selected');

            if (!selectedFilters) {
                $resetFilterChips.addClass('hidden');
            }

            if (this.ctx.shouldShow) {

                this.$element.toggleClass('hidden', !this.ctx.shouldShow());
            }
        }

        /**
         * Handles the selection of an item.
         * @param {number} index - The index of the selected item.
         * @param {Object} item - The selected item object.
         *
         * @returns {undefined}
         */
        onItemSelect(index, item) {

            if (index === this.selectedIndex) {
                this.resetToDefault();
                M.openFolder(M.currentdirid, true);
                if (this.autoDismiss) {
                    this.hide(true);
                }
                return;
            }

            item.el.classList.add('selected');

            for (let i = 0; i < this._options.length; i++) {
                if (item.el !== this._options[i].el) {
                    this._options[i].deselectItem();
                    this._options[i].el.classList.remove('selected');
                }
            }

            this.selectedIndex = index;

            if (this.autoDismiss) {
                this.hide(true);
            }

            const entry = this.ctx.menu[index];
            if (entry.eid) {
                eventlog(entry.eid, JSON.stringify([1, !!pfid | 0, M.getPath(M.currentdirid).length]));
            }
            this.ctx.selection = entry.data;

            selectedFilters |= this.ident;
            this.$text.text(item.el.innerText);
            this.$element.addClass('selected');
            $resetFilterChips.removeClass('hidden');

            // @todo instead of going all through openFolder() we may want to filterBy(search|parent) + renderMain()
            M.openFolder(M.currentdirid, true);
        }
    }

    // Public API.
    return freeze({
        /**
         * Sets up the chips, checking the current page and initializing the type filter chip if applicable.
         *
         * @returns {undefined}
         */
        initSearchFilter() {
            $filterChipsWrapper.removeClass('hidden');

            for (const name in filters) {
                const ctx = filters[name];

                if (!ctx.component) {
                    ctx.component = new FilterChip(name);
                }
            }

            $resetFilterChips.rebind('click.resetFilters', () => {

                M.openFolder(M.currentdirid, true);
            });
        },
        match(n) {

            if (n.name && n.p !== 'contacts' && !(n.s4 && n.p === this.RootID)) {

                for (const name in filters) {
                    const ctx = filters[name];

                    if (ctx.selection && !ctx.match(n)) {

                        return false;
                    }
                }

                return true;
            }

            return false;
        },
        resetFilterSelections(stash) {

            if (!stash) {

                for (const name in filters) {
                    const ctx = filters[name];

                    if (ctx.component) {
                        ctx.component.resetToDefault();
                    }
                }
            }

            const hidden = M.gallery || M.chat || M.albums
                || M.currentrootid === M.RubbishID
                || hiddenSections.has(M.currentdirid)
                || M.currentrootid && M.currentrootid === (M.BackupsId && M.getNodeByHandle(M.BackupsId).p)
                || M.currentrootid === 's4' && M.currentCustomView.subType !== 'bucket'
                || String(M.currentdirid).startsWith('user-management')
                || folderlink;

            if (hidden) {
                $filterChipsWrapper.addClass('hidden');
            }
            else {
                this.initSearchFilter();
            }
        },
        get selectedFilters() {
            return selectedFilters;
        }
    });
});

/** @property mega.ui.mInfoPanel */
lazy(mega.ui, 'mInfoPanel', () => {
    'use strict';

    // DOM caches
    const $container = $('.folder-file-info-panel');

    // Other constants
    const visibleClass = 'info-panel-visible';

    /**
     * Logic to reset panel to default, clear values, icons etc
     * @returns {undefined}
     */
    function resetToDefault() {

        // Update DOM
        const $blockView = $('.block-view-file-type', $container);

        $('.name-section .description', $container).addClass('hidden');
        $('.name-value', $container).text('');
        $('.type-section', $container).addClass('hidden');
        $('.type-value', $container).text('');
        $('.size-value', $container).text('');
        $('.path-section', $container).addClass('hidden');
        $('.path-value', $container).text('');
        $('.date-added-section', $container).addClass('hidden');
        $('.last-modified-section', $container).addClass('hidden');
        $('.date-added-value', $container).text('');
        $('.contains-section', $container).addClass('hidden');
        $('.contains-value', $container).text('');
        $('.permissions-section', $container).addClass('hidden');
        $('.permissions-icon', $container).addClass('hidden');
        $('.permissions-value', $container).text('');
        $('.owner-section', $container).addClass('hidden');
        $('.owner-value', $container).text('');
        $('.version-section', $container).addClass('hidden');
        $('.version-value', $container).text('');
        $('.current-version-section', $container).addClass('hidden');
        $('.current-version-value', $container).text('');
        $('.prev-version-section', $container).addClass('hidden');
        $('.prev-version-value', $container).text('');
        $('.node-description-section', $container).addClass('hidden');
        $('.node-description-section .descCounter', $container).addClass('hidden');
        $('.node-description-section', $container).removeClass('readonly');

        $container.removeClass('taken-down');
        $container.removeClass('undecryptable');
        $blockView.removeClass().addClass('block-view-file-type').addClass('item-type-icon-90');
        $('img', $blockView).attr('src', '');
        $('img', $blockView).addClass('hidden');
    }

    /**
     * Get all the node data (so we only look it up once)
     * @param {Array} selectedNodeHandles Array of node handles
     * @returns {Array} Returns an array of nodes
     */
    function getAllNodeData(selectedNodeHandles) {

        const nodes = [];

        for (let i = selectedNodeHandles.length; i--;) {

            const nodeHandle = selectedNodeHandles[i];
            const node = M.getNodeByHandle(nodeHandle);

            if (!node) {
                continue;
            }

            nodes.push(node);
        }

        // reverse the list to maintain nodes original order to be use on scroll
        return nodes.reverse();
    }

    /**
     * From the selected nodes, get how many folders and files are selected
     * @param {Array} nodes Array of nodes
     * @returns {String} Returns how many e.g. 3 folders, 2 files
     */
    function getSelectedFolderAndFileCount(nodes) {

        let folderCount = 0;
        let fileCount = 0;

        for (let i = 0; i < nodes.length; i++) {

            const node = nodes[i];

            if (node.t) {
                folderCount++;
            }
            else {
                fileCount++;
            }
        }

        // Reword e.g. 3 folders, 2 files
        return fm_contains(fileCount, folderCount, false);
    }

    /**
     * From the selected nodes, get the total size of them in Bytes (formatted for user)
     * @param {Array} nodes Array of nodes
     * @returns {String} Returns the size e.g.  200 MB
     */
    function getSize(nodes) {

        let totalBytes = 0;

        for (let i = 0; i < nodes.length; i++) {

            const node = nodes[i];

            if (node.t) {
                totalBytes += node.tb;
            }
            else {
                totalBytes += node.s;
            }
        }

        return bytesToSize(totalBytes);
    }

    /**
     * From the selected node handle, get the path to the node
     * @param {String} node node
     * @returns {String} folder/file path
     */
    function getPath(node) {

        const pathItems = M.getPath(node.h);

        // return false when no path found
        if (pathItems && !pathItems.length) {
            return false;
        }

        const path = document.createElement('div');

        // Reverse order so the root node is first
        pathItems.reverse();

        for (let i = 0; i < pathItems.length; i++) {

            const pathItemHandle = pathItems[i];
            const node = M.getNodeByHandle(pathItemHandle);
            const $span = document.createElement('span');
            let nodeName = node.name;

            // Add Cloud drive for the initial handle
            if (pathItemHandle === M.RootID) {
                nodeName = l[164];
            }
            else if (pathItemHandle === M.RubbishID) {
                nodeName = l[167];
            }

            // Skip if no node name available
            if (!nodeName) {
                continue;
            }

            // Add the folder/file name and an ID of the handle so we can add a click handler for it later
            $span.textContent = nodeName;
            $span.dataset.nodeId = node.h;

            // Keep building up the path HTML
            path.appendChild($span);

            // Add the path separator except for the last item
            if (i < pathItems.length - 1) {
                path.appendChild(document.createTextNode(' \u{3E} '));
            }
        }

        return path;
    }

    /**
     * From the selected nodes, get how many sub folders and files this contains
     * @param {Array} nodes
     * @returns {String} Returns how many e.g. 3 folders, 2 files
     */
    function getContainsCount(nodes) {

        let totalSubDirCount = 0;
        let totalSubFilesCount = 0;
        let selectionIncludesDir = false;

        for (let i = 0; i < nodes.length; i++) {

            const node = nodes[i];

            // If type folder, total up the dirs and files in the folder
            if (node.t) {
                totalSubDirCount += node.td;
                totalSubFilesCount += node.tf;
                selectionIncludesDir = true;
            }
        }

        // If there's no folder in the selection, return empty string and the caller will hide the Contains block
        if (!selectionIncludesDir) {
            return '';
        }

        // Reword e.g. 3 folders, 2 files
        return fm_contains(totalSubFilesCount, totalSubDirCount, false);
    }

    /**
     * Adds a click handler for the items in the Path so that the user can open that folder or file
     * @returns {undefined}
     */
    function addClickHandlerForPathValues() {

        $('.path-value span', $container).rebind('click.pathClick', function() {

            const nodeHandle = $(this).attr('data-node-id');
            const node = M.getNodeByHandle(nodeHandle);

            // If type folder, open it in the cloud drive
            if (node.t) {
                M.openFolder(nodeHandle);
            }

            // If an image, load the slideshow
            else if (is_image2(node)) {
                slideshow(nodeHandle);
            }

            // If it's a video, load the video viewer
            else if (is_video(node)) {
                $.autoplay = nodeHandle;
                slideshow(nodeHandle);
            }

            // If a text file, load the text editor
            else if (is_text(node)) {

                loadingDialog.show();

                mega.fileTextEditor.getFile(nodeHandle).done((data) => {
                    loadingDialog.hide();
                    mega.textEditorUI.setupEditor(node.name, data, nodeHandle);
                }).fail(() => {
                    loadingDialog.hide();
                });
            }
            else {
                // Download
                M.addDownload([nodeHandle]);
            }
        });
    }

    /**
     * Adds a click handler for files/folder with versions to see version list of it
     * @returns {undefined}
     */
    function addClickHandlerVersionsValue() {

        $('.version-value span', $container).rebind('click.prevVersion', function() {

            const nodeHandle = $(this).attr('data-node-id');
            const node = M.getNodeByHandle(nodeHandle);

            if (M.currentrootid !== M.RubbishID) {

                // If the slideshow is currently showing, hide it otherwise the file versioning dialog won't appear
                if (slideshowid) {
                    slideshow(node.h, 1);
                }
                fileversioning.fileVersioningDialog(node.h);
            }
        });
    }

    /**
     * For multiple selected nodes, find an icon we can use (especially if all the same type we can use that icon)
     * @param {Array} selectedNodes An array of selected nodes
     * @returns {String} Returns the class name of the icon e.g. folder/file/inbound-share
     */
    function getIconForMultipleNodes(selectedNodes) {

        const totalNodeCount = selectedNodes.length;
        let regularFolderCount = 0;
        let incomingSharedFolderCount = 0;
        let outgoingSharedFolderCount = 0;
        let isFolders = 0;

        // Go through the selected nodes and count up what types are selected
        for (let i = 0; i < selectedNodes.length; i++) {

            const node = selectedNodes[i];

            if (typeof node.r === 'number') {
                incomingSharedFolderCount++;
            }
            else if (node.t & M.IS_SHARED || M.ps[node.h] || M.getNodeShareUsers(node, 'EXP').length) {
                outgoingSharedFolderCount++;
            }
            else if (node.t) {
                regularFolderCount++;
            }
        }
        isFolders = incomingSharedFolderCount + outgoingSharedFolderCount + regularFolderCount;

        // If all selected nodes are incoming shares, show the incoming share icon
        if (incomingSharedFolderCount === totalNodeCount) {
            return 'folder-incoming';
        }

        // If all selected nodes are incoming shares, show the incoming share icon
        if (outgoingSharedFolderCount === totalNodeCount) {
            return 'folder-outgoing';
        }

        // If all selected nodes are folders, show the folder icon
        if (regularFolderCount === totalNodeCount || isFolders === totalNodeCount) {
            return 'folder';
        }

        // Otherwise the default is file for any mix of folders/files or just files
        return 'generic';
    }

    /**
     * Checks if all of the currently selected nodes are taken down. If a mix of taken down nodes and normal files are
     * selected the UI will not change to mention the taken down nodes. Only if 1 or more taken down nodes are selected
     * will the UI be updated.
     * @param {Array} selectedNodes An array of selected nodes
     * @returns {Boolean} Returns true if all nodes are taken down
     */
    function containsAllTakenDownNodes(selectedNodes) {

        let takenDownNodeCount = 0;
        const totalNodeCount = selectedNodes.length;

        for (let i = 0; i < totalNodeCount; i++) {

            const node = selectedNodes[i];

            // If taken down, increase the count
            if (node.t & M.IS_TAKENDOWN || M.getNodeShare(node).down === 1) {
                takenDownNodeCount++;
            }
        }

        return (takenDownNodeCount === totalNodeCount);
    }

    /**
     * Scroll to selected element within the current view
     * @param {String} nodeHandle selected node handle
     * @returns {undefined}
     */
    function scrollToNode(nodeHandle) {

        if (!nodeHandle) {
            return;
        }

        var grid = $($.selectddUIgrid);

        if (grid.length && grid.hasClass('ps')) {

            if (M.megaRender && M.megaRender.megaList) {
                delay('infoPanelScroll', () => M.megaRender.megaList.scrollToItem(nodeHandle), 500);
            }
            else {
                const el = $(`#${nodeHandle}`, $(`${$.selectddUIgrid}:visible`));
                delay('infoPanelScroll', scrollToElement.bind(this, el.closest('.ps'), el), 500);
            }
        }
    }

    /**
     * Initialise or update the side panel's vertical scroll block (if the content gets too long)
     * @returns {undefined}
     */
    function initOrUpdateScrollBlock() {

        const scrollBlock = $('.info-panel-scroll-block', $container);

        if (scrollBlock.is('.ps')) {
            Ps.update(scrollBlock[0]);
        }
        else {
            Ps.initialize(scrollBlock[0]);
        }
    }

    /**
     * Gets the name of the selected node (or generic string for the nodes that are selected)
     * @param {Array} selectedNodes The selected nodes
     * @returns {String}
     */
    function getNodeName(selectedNodes) {

        if (selectedNodes.length > 1) {
            return getSelectedFolderAndFileCount(selectedNodes);
        }

        return selectedNodes[0].ch ? selectedNodes[0].name : M.getNameByHandle(selectedNodes);
    }

    /**
     * Render node description
     * @param {MegaNode} node selected node
     * @returns {undefined}
     */
    function renderNodeDescription(node) {

        // Hide for S4 nodes
        const isS4 = 'kernel' in s4 && s4.kernel.getS4NodeType(node.h);

        if (M.RootID === node.h && !folderlink || node.devid || isS4) {
            return;
        }

        // Node description
        const $section = $(`.node-description-section.${mega.flags.ab_ndes ? 'top' : 'bottom'}`, $container);
        $section.removeClass('hidden');
        const $descInput = $('.node-description-textarea textarea', $section);
        const $descCounter = $('.descCounter', $section);
        const $descCounterVal = $('span', $descCounter);
        const description = from8(node.des || '');

        $descInput.attr('placeholder', l.info_panel_description_add);

        const descriptionEventHandler = () => {

            // Changing description length counter
            $descInput.rebind('input.nodeDescription', (e) => {
                $descCounterVal.text($(e.currentTarget).val().length);
            });

            // Save description when hit enter
            $descInput.rebind('keydown.nodeDescription', (e) => {
                e.stopPropagation();
                const key = e.keyCode || e.which;

                $descCounter.removeClass('hidden');

                if (key === 13 && !e.shiftKey && !e.ctrlKey && !e.altKey) {
                    e.currentTarget.blur();
                }
            });

            // Save description upon unfocus/blur
            $descInput.rebind('blur.nodeDescription', (e) => {
                // Saving node description
                const $descValue = $(e.currentTarget).val();
                const prevDesc = description;

                // Skipped if no changes/Description length max 300 char/Document focus
                if (prevDesc !== $descValue && $descValue.length <= 300 && document.hasFocus()) {
                    M.setNodeDescription(node.h, to8($descValue))
                        .then(() => {
                            if (prevDesc === '') {
                                showToast('info', l.info_panel_description_added);
                                if (mega.flags.ab_ndes) {
                                    // Top position node description added event log
                                    eventlog(500252);
                                }
                                else {
                                    // Bottom position node description added event log
                                    eventlog(500253);
                                }
                            }
                            else {
                                showToast('info', l.info_panel_description_updated);
                            }
                        })
                        .catch(dump);
                }

                if ($descValue === '') {
                    $descCounter.addClass('hidden');
                }
            });

            // For styling the mega textarea
            $('.node-description-textarea > *', $section)
                .focus((e)=> {
                    const $currTarget = $(e.currentTarget);
                    $currTarget.closest('.node-description.mega-textarea').addClass('active');
                    $currTarget.attr("spellcheck", "true");
                    if (mega.flags.ab_ndes) {
                        // Top position node description focus event log
                        eventlog(500250);
                    }
                    else {
                        // Bottom position node description focus event log
                        eventlog(500251);
                    }
                })
                .blur((e) => {
                    const $currTarget = $(e.currentTarget);
                    $currTarget.closest('.node-description.mega-textarea').removeClass('active');
                    $currTarget.attr("spellcheck", "false");
                });
        };

        // Fill node description text area
        if (description) {
            $descInput.val(description);
            $descCounterVal.text(description.length);
            $descCounter.removeClass('hidden');
        }
        else {
            $descInput.val('');
            $descCounter.addClass('hidden');
        }

        // Apply scrollbar to the textarea
        initTextareaScrolling($descInput);

        if (M.getNodeRights(node.h) < 2 || M.currentrootid === M.RubbishID ||
            folderlink || M.getNodeRoot(node.h) === M.InboxID || node.ch) {
            $descInput.attr('disabled','disabled');
            $descInput.attr('placeholder', l.info_panel_description_empty);
            $('.descPermission', $section).removeClass('hidden');
            $('.descPermission span', $section).text(l[55]);  // Read-only
            $section.addClass('readonly');
        }
        else {
            $('.descPermission', $section).addClass('hidden');
            $descInput.removeAttr('disabled');
            descriptionEventHandler();
            $section.removeClass('readonly');
        }
    }

    /**
     * Get the title of the Info panel
     * @param {Array} selectedNodes The selected nodes
     * @returns {String}
     */
    function getPanelTitle(selectedNodes) {

        // For multiple nodes selected
        if (selectedNodes.length > 1) {
            return mega.icu.format(l.selected_items_count, selectedNodes.length); // X items selected
        }

        // Single node
        return l[6859]; // Info
    }

    /**
     * Get the permissions text, icon and owner information for a single node
     * @param {Object} node The selected node
     * @returns {Object} An object containing the permissionsText, permissionsIcon and ownerText if applicable
     */
    function getSingleNodePermissionsData(node) {

        let permissionsText;
        let permissionsIcon;
        let ownerText;

        // Check permissions on node (shown for inshares)
        if (typeof node.r === 'number') {
            permissionsText = l[55];        // Read-only
            permissionsIcon = 'icon-read-only';

            if (node.r === 1) {
                permissionsText = l['56'];  // Read and write
                permissionsIcon = 'icon-permissions-write';
            }
            else if (node.r === 2) {
                permissionsText = l[57];    // Full access
                permissionsIcon = 'icon-star';
            }

            // Get owner information
            const user = Object(M.d[node.su || node.p]);
            ownerText = htmlentities(M.getNameByHandle(user.h));
        }

        return { permissionsText, permissionsIcon, ownerText };
    }

    /**
     * Render thumbnail image/videos if applicable
     * @param {Array} selectedNodes The currently selected nodes
     * @returns {undefined}
     */
    function renderIconOrThumbnail(selectedNodes) {

        const $blockView = $('.block-view-file-type', $container);
        const $iconFrame = $('.icon-frame', $container);
        const $imgContainer = $('img', $blockView);
        const isTakenDown = containsAllTakenDownNodes(selectedNodes);

        // If more than one node is selected, set a generic icon e.g. folder or file
        if (selectedNodes.length > 1) {
            const nodeIcon = getIconForMultipleNodes(selectedNodes);

            // Update DOM
            $blockView.addClass(`icon-${nodeIcon}-90`);
            $('.video-thumb-details', $blockView).remove();
            return;
        }

        const node = selectedNodes[0];
        const nodeIcon = fileIcon(node);

        // Update DOM
        $blockView.addClass(`icon-${nodeIcon}-90`);
        $('.video-thumb-details', $blockView).remove();

        // If Image/Video/Raw render thumbnail image/videos
        if (['image', 'video', 'raw', 'photoshop', 'vector'].includes(nodeIcon) && !isTakenDown &&
            (is_image3(node) || nodeIcon === 'video' && mega.gallery.isVideo(node))) {

            $blockView.addClass('img-thumb');

            // Set image loader
            const iconFrameElement = $iconFrame.get(0);
            if (iconFrameElement) {
                mega.gallery.setShimmering(iconFrameElement);
            }
            getImage(node)
                .then((url) => {
                    if (url) {
                        $imgContainer.attr('src', url);
                        $imgContainer.removeClass('hidden');

                        // If video render video duration into thumbnail
                        if (mega.gallery.isVideo(node)) {

                            const div = document.createElement('div');
                            div.className = 'video-thumb-details';
                            $blockView[0].appendChild(div);

                            const spanTime = document.createElement('span');
                            spanTime.textContent = secondsToTimeShort(MediaAttribute(node).data.playtime);
                            div.appendChild(spanTime);
                        }
                    }
                    else {
                        $blockView.removeClass('img-thumb');
                    }
                })
                .catch(() => {
                    // Bring back to icon view
                    $blockView.removeClass('img-thumb');
                })
                .finally(() => {
                    // Fix exception if not set on public link
                    if (iconFrameElement) {
                        mega.gallery.unsetShimmering(iconFrameElement);
                    }
                });

        }
    }

    /**
     * Render the versioning info
     * @param {Array} selectedNodes The selected nodes
     * @returns {undefined}
     */
    function renderSizeAndVersioningInfo(selectedNodes) {

        let totalSize;

        // For multiple nodes, just get the total size
        if (selectedNodes.length > 1) {
            totalSize = getSize(selectedNodes);
        }
        else {
            // Single node selected
            const node = selectedNodes[0];
            let versioningFlag = false;
            let size;
            let versionSize;
            let versionCount;

            // Get total bytes for folder, or the file size
            totalSize = bytesToSize(node.t ? node.tb : node.s);

            // Hide versioning details temporarily, due to it not working correctly in MEGA Lite / Infinity
            if (node.tvf && !mega.lite.inLiteMode) {
                versioningFlag = true;
                versionCount = mega.icu.format(l.version_count, node.tvf);  // Version Count
                versionSize = bytesToSize(node.tvb || 0);                   // Version Size
                totalSize = bytesToSize(node.t ? node.tb + node.tvb : node.s + node.tvb);
                size = bytesToSize(node.t ? node.tb : node.s);        // Current Version size
            }

            // If the user has versioning enabled for their files in the settings
            if (versioningFlag) {

                // Show version count
                $('.version-section', $container).removeClass('hidden');

                if (node.t) {
                    $('.version-value', $container).text(versionCount);
                }
                else {
                    const $span = document.createElement('span');
                    $span.textContent = versionCount;
                    $span.dataset.nodeId = node.h;
                    $('.version-value', $container).get(0).appendChild($span);

                    addClickHandlerVersionsValue();
                }

                // Show Version current size
                $('.current-version-section', $container).removeClass('hidden');
                $('.current-version-value', $container).text(size);

                // Show Previous version size
                $('.prev-version-section', $container).removeClass('hidden');
                $('.prev-version-value', $container).text(versionSize);
            }
        }

        // Render total size
        $('.size-value', $container).text(totalSize);
    }

    /**
     * Render takedown folder/file
     * @param {Array} selectedNodes The selected nodes
     * @returns {undefined}
     */
    function renderTakedown(selectedNodes) {
        const isTakenDown = containsAllTakenDownNodes(selectedNodes);

        // If there are taken down nodes within the currently selected nodes, update the display to show that
        if (isTakenDown) {
            const warningText = mega.icu.format(l.item_subject_to_takedown, selectedNodes.length);
            $('.takedown-warning', $container).text(warningText);
            $container.addClass('taken-down');
        }
    }

    /**
     * Adding class to media viewer or meeting call is active
     * @returns {undefined}
     */
    function checkCurrentView() {
        // If we have the photo viewer open add a class to the container so we can hide some of the top right menu
        if ($('.media-viewer-container', 'body').hasClass('hidden')) {
            $container.removeClass('media-viewer-visible');
        }
        else {
            $container.addClass('media-viewer-visible');
        }

        // if we have meeting open add class to the container to hide some element from the top right menu
        if ($('.meetings-call', '.conversation-panel').length) {
            $container.addClass('meetings-visible');
        }
        else {
            $container.removeClass('meetings-visible');
        }
    }

    /**
     * Get node dates to html
     * @param {Number} date selected node dates
     * @returns {String} date
     */
    function getDate(date) {
        return date && htmlentities(time2date(date)) || '';
    }

    /**
     * Main render function
     * @param {Array} selectedNodeHandles Array of selected nodes
     * @returns {undefined|Object} The jquery object of the warning dialog
     */
    function renderInfo(selectedNodeHandles) {

        let node;
        let nodeType;
        let containsText;
        let path;
        let dateAdded;
        let lastModified;
        let permissionsText;
        let permissionsIcon;
        let ownerText;
        let isUndecrypted = false;

        // Of there are no selected nodes, return
        if (!selectedNodeHandles.length) {
            return;
        }

        // Get data for all the selected nodes
        const selectedNodes = getAllNodeData(selectedNodeHandles);

        // If there is a node, make sure it's valid, otherwise close the panel
        if (selectedNodeHandles.length === 1 && !selectedNodes[0]) {

            // For Devices page, show Warning: 'The folder does not exist'
            if (page === 'fm/devices') {
                return msgDialog('warninga', l[882], l[24196]);
            }

            mega.ui.mInfoPanel.closeIfOpen();
            return;
        }

        // If multiple nodes selected
        if (selectedNodeHandles.length > 1) {
            nodeType = l[1025]; // Multiple items
            containsText = getContainsCount(selectedNodes);
        }
        else {
            // Single node selected
            node = selectedNodes[0];

            // Get single node data
            nodeType = node.t ? l[1049] : filetype(node, 0);
            path = getPath(node);
            dateAdded = getDate(node.ts);
            lastModified = getDate(node.mtime);
            isUndecrypted = missingkeys[node.h];

            // If type folder, we need to show the total of the contents (or empty folder if empty)
            if (node.t) {
                containsText = getContainsCount([node]);
            }

            // Get the permissions data if applicable
            ({ permissionsText, permissionsIcon, ownerText } = getSingleNodePermissionsData(node));
        }

        // Reset previous state
        resetToDefault();
        initOrUpdateScrollBlock();

        // Get data
        const panelTitle = getPanelTitle(selectedNodes);
        const nodeName = getNodeName(selectedNodes);

        // Update DOM
        $('.header-title', $container).text(panelTitle);
        $('.name-value', $container).text(nodeName);
        $('.type-value', $container).text(nodeType);

        // If this selection has subfolders and files, show it
        if (containsText) {
            $('.contains-section', $container).removeClass('hidden');
            $('.contains-value', $container).text(containsText);
        }

        // Name for undecrypted node
        if (isUndecrypted) {
            $('.name-value', $container).text(l[8649]);
            $container.addClass('undecryptable');
            showToast('clipboard', M.getUndecryptedLabel(node));
        }
        // If this single node selection has a Path, show it and should be decrypted
        else if (path) {
            $('.path-section', $container).removeClass('hidden');
            $('.path-value', $container).get(0).appendChild(path);

            addClickHandlerForPathValues();
        }

        // If this single node selection has a Date Modified, show it
        if (lastModified) {
            $('.last-modified-section', $container).removeClass('hidden');
            $('.last-modified-value', $container).text(lastModified);
        }

        // If this single node selection is an In-share with permissions information, show it
        if (permissionsText) {
            $('.permissions-section', $container).removeClass('hidden');
            $(`.permissions-icon.${permissionsIcon}`, $container).removeClass('hidden');
            $('.permissions-value', $container).text(permissionsText);
        }
        else {
            // Show the Type except for In-shares and Backups sections where we do not show it
            if (M.currentdirid !== M.BackupsId) {
                $('.type-section', $container).removeClass('hidden');
            }

            // If this single node selection has a Date Added, show it (NB: don't show for in-shares)
            if (dateAdded) {
                $('.date-added-section', $container).removeClass('hidden');
                $('.date-added-value', $container).text(dateAdded);
            }
        }

        // If this single node selection is an inshare with an owner, show who owns it
        if (ownerText) {
            $('.owner-section', $container).removeClass('hidden');
            $('.owner-value', $container).safeHTML(ownerText);
        }

        // If just one node selected, show the Name label (just showing the # of files/folders instead for multiple)
        if (selectedNodeHandles.length === 1) {
            $('.name-section .description', $container).removeClass('hidden');

            renderNodeDescription(node);
        }

        // Render icons/thumbnails as applicable
        renderIconOrThumbnail(selectedNodes);

        // Render size (and version information if applicable)
        renderSizeAndVersioningInfo(selectedNodes);

        // Render takedown file/folder
        renderTakedown(selectedNodes);

        // Check if media viewer or meeting call ui is active
        checkCurrentView();

        // If the rewind sidebar is visible we need to hide it (no room for both sidebars on the screen)
        if (mega.rewindUi && mega.rewindUi.sidebar.active) {
            mega.rewindUi.sidebar.forceClose();
        }
    }

    // Public API
    return freeze({

        /**
         * Sets up the info panel
         * @returns {undefined}
         */
        initInfoPanel() {

            // Scroll to element
            scrollToNode($.selected[0]);

            // Show the panel
            $('body').addClass(visibleClass);

            // Init the Close button to hide the panel
            $('.close', $container).rebind('click.closeButton', () => {
                $('body').removeClass(visibleClass);

                // Trigger a resize for the grid mode tiles to fill up the void
                $.tresizer();
            });

            // Render the selected node info into the panel
            renderInfo($.selected);

            // Trigger a resize for the grid tiles to move
            $.tresizer();
        },

        /**
         * Re-render the contents of the Info panel if they selected a new node/s while the panel is already open
         * @param {Array} selectedNodes An array of the handles that are selected in the UI (e.g. call with $.selected)
         * @returns {undefined}
         */
        reRenderIfVisible(selectedNodes) {

            const isOpen = $('body').hasClass(visibleClass);

            // If it's already visible, render the selected node information (no need for resizes etc)
            if (isOpen && selectedNodes && selectedNodes.length > 0) {
                renderInfo(selectedNodes);
            }
        },

        /**
         * Close the Info panel if it's currently visible
         * @returns {undefined}
         */
        closeIfOpen() {

            const isOpen = $('body').hasClass(visibleClass);

            // If it's already visible, close the panel
            if (isOpen) {
                $('body').removeClass(visibleClass);
            }
        }
    });
});

/**
 * Functionality for the Notifications popup
 *
 * 1) On page load, fetch the latest x number of notifications. If there are any new ones, these should show a
 *    number e.g. (3) in the red circle to indicate there are new notifications.
 * 2) When they click the notifications icon, show the popup and whatever notifications the user has.
 * 3) On action packet receive, put the notification at the top of the queue and update the red circle to indicate a
 *    new notification. Next time the popup opens this will show the new notification and old ones.
 */
var notify = {

    /** The current notifications **/
    notifications: [],

    /** Number of notifications to fetch in the 'c=100' API request. This is reduced to 50 for fast rendering. */
    numOfNotifications: 50,

    /** Locally cached emails and pending contact emails */
    userEmails: Object.create(null),

    /** jQuery objects for faster lookup */
    $popup: null,
    $popupIcon: null,
    $popupNum: null,

    /** Promise of if the intial notifications have loaded */
    initialLoading: false,

    /** A flag for if the initial loading of notifications is complete */
    initialLoadComplete: false,

    /** A list of already rendered pending contact request IDs (multiple can exist with reminders) */
    renderedContactRequests: [],

    /** Temp list of accepted contact requests */
    acceptedContactRequests: [],

    // The welcome dialog has been shown this session
    welcomeDialogShown: false,

    // Whether the event for viewing the dynamic notifications has been sent
    dynamicNotifsSeenEventSent: false,

    // Current dynamic notifications
    dynamicNotifs: {},
    lastSeenDynamic: undefined,

    /**
     * Initialise the notifications system
     */
    init: function() {

        // Cache lookups
        notify.$popup = $('.js-notification-popup');
        notify.$popupIcon = $('.top-head .top-icon.notification');
        notify.$popupNum = $('.js-notification-num');

        // Init event handler to open popup
        notify.initNotifyIconClickHandler();

        // Recount the notifications and display red tooltip because they opened a new page within Mega
        notify.countAndShowNewNotifications();
    },

    /**
     * Get the most recent 100 notifications from the API
     */
    getInitialNotifications: function() {

        // Clear notifications before fetching (sometimes this needs to be done if re-logging in)
        notify.notifications = [];

        // Call API to fetch the most recent notifications
        notify.initialLoading = api.req(`c=${this.numOfNotifications}`, 3)
            .then(({result}) => {

                // Check it wasn't a negative number error response
                assert(typeof result === 'object');

                // Get the current UNIX timestamp and the last time delta (the last time the user saw a notification)
                var currentTime = unixtime();
                var lastTimeDelta = (result.ltd) ? result.ltd : 0;
                var notifications = result.c;
                var pendingContactUsers = result.u;

                // Add pending contact users
                notify.addUserEmails(pendingContactUsers);

                // Loop through the notifications
                if (notifications) {
                    for (var i = 0; i < notifications.length; i++) {

                        // Check that the user has enabled notifications of this type or skip it
                        if (notify.isUnwantedNotification(notifications[i])) {
                            continue;
                        }

                        var notification = notifications[i];            // The full notification object
                        var id = makeid(10);                            // Make random ID
                        var type = notification.t;                      // Type of notification e.g. share
                        var timeDelta = notification.td;                // Seconds since the notification occurred
                        var seen = (timeDelta >= lastTimeDelta);        // If the notification time delta is older than the last time the user saw the notification then it is read
                        var timestamp = currentTime - timeDelta;        // Timestamp of the notification
                        var userHandle = notification.u;                // User handle e.g. new share from this user

                        if (!userHandle && notification.t === 'ipc') {
                            // incoming pending contact
                            userHandle = notification.p;
                        }
                        else if (!userHandle && type === 'puu') {
                            // public upload user
                            // - TBD.
                        }

                        // Add notifications to list
                        const newNotification = {
                            data: notification, // The full notification object
                            id: id,
                            seen: seen,
                            timeDelta: timeDelta,
                            timestamp: timestamp,
                            type: type,
                            userHandle,
                        };

                        if (type === 'puu') {
                            newNotification.allDataItems = [notification.h];
                            if (!notify.combinePuuNotifications(newNotification)) {
                                notify.notifications.push(newNotification);
                            }
                        }
                        else {
                            notify.notifications.push(newNotification);
                        }
                    }
                }

                // After the first SC request all subsequent requests can generate notifications
                notify.initialLoadComplete = true;

                // Show the notifications
                notify.countAndShowNewNotifications();

                // If the popup is already open (they opened it while the notifications were being fetched) then render
                // the notifications. If the popup is not open, then clicking the icon will render the notifications.
                if (!notify.$popup.hasClass('hidden')) {
                    notify.renderNotifications();
                }
            })
            .catch(dump);
    },

    /**
     * Adds a notification from an Action Packet
     * @param {Object} actionPacket The action packet object
     */
    notifyFromActionPacket: async function(actionPacket) {
        'use strict';

        // We should not show notifications if we haven't yet done the initial notifications load yet
        if (!notify.initialLoadComplete || notify.isUnwantedNotification(actionPacket)) {
            return false;
        }

        // Construct the notification object
        var newNotification = {
            data: actionPacket,                             // The action packet
            id: makeid(10),                                 // Make random ID
            seen: actionPacket.seen || false,                                  // New notification, so mark as unread
            timeDelta: 0,                                   // Time since notification was sent
            timestamp: actionPacket.timestamp || unixtime(),                   // Get the current timestamps in seconds
            type: actionPacket.a,                           // Type of notification e.g. share
            userHandle: actionPacket.u || actionPacket.ou   // User handle e.g. new share from this user
        };

        if (actionPacket.a === 'dshare' && actionPacket.orig && actionPacket.orig !== u_handle) {
            newNotification.userHandle = actionPacket.orig;
        }

        // If the user handle is not known to the local state we need to fetch the email from the API. This happens in
        // some sharing scenarios where a user is part of a share then another user adds files to the share but they
        // are not contacts with that other user so the local state has no information about them and would display a
        // broken notification if the email is not known.
        if (newNotification.type === 'put' && String(newNotification.userHandle).length === 11) {

            this.getUserEmailByTheirHandle(newNotification.userHandle);
        }

        if (newNotification.type === 'puu') {
            newNotification.allDataItems = actionPacket.f.map((e) => e.h);
        }

        // Combines the current new notification with the previous one if it meets certain criteria
        notify.combineNewNotificationWithPrevious(newNotification);

        // Show the new notification icon
        notify.countAndShowNewNotifications();

        // If the popup is open, re-render the notifications to show the latest one
        if (!notify.$popup.hasClass('hidden')) {
            notify.renderNotifications();
        }
    },

    /**
     * Check whether we should omit a notification.
     * @param {Object} notification
     * @returns {Boolean}
     */
    isUnwantedNotification: function(notification) {

        var action;

        if (notification.dn) {
            return true;
        }

        switch (notification.a || notification.t) {
            case 'put':
            case 'share':
            case 'dshare':
                if (!mega.notif.has('cloud_enabled')) {
                    return true;
                }
                break;

            case 'c':
            case 'ipc':
            case 'upci':
            case 'upco':
                if (!mega.notif.has('contacts_enabled')) {
                    return true;
                }
                break;
            case 'd':
                if (notification.v) {
                    return true;
                }
                break;
        }

        switch (notification.a || notification.t) {
            case 'put':
                if (!mega.notif.has('cloud_newfiles')) {
                    return true;
                }
                break;

            case 'share':
                if (!mega.notif.has('cloud_newshare')) {
                    return true;
                }
                break;

            case 'dshare':
                if (!mega.notif.has('cloud_delshare')) {
                    return true;
                }
                break;

            case 'ipc':
                if (!mega.notif.has('contacts_fcrin')) {
                    return true;
                }
                break;

            case 'c':
                action = (typeof notification.c !== 'undefined') ? notification.c : notification.u[0].c;
                if ((action === 0 && !mega.notif.has('contacts_fcrdel')) ||
                    (action === 1 && !mega.notif.has('contacts_fcracpt'))) {
                    return true;
                }
                break;

            case 'upco':
                action = (typeof notification.s !== 'undefined') ? notification.s : notification.u[0].s;
                if (action === 2 && !mega.notif.has('contacts_fcracpt')) {
                    return true;
                }
                break;

            case 'puu':
                if (mega.notif.has('cloud_upload')) {
                    return true;
                }
                break;

            default:
                break;
        }
        return false;
    },

    combinePuuNotifications(currentNotification) {
        'use strict';

        const previousNotification = notify.notifications[notify.notifications.length - 1];
        if (!(currentNotification && previousNotification)) {
            return false;
        }

        // This function is currently only needed for 'puu' notifications
        if (currentNotification.type !== 'puu' || previousNotification.type !== 'puu') {
            return false;
        }

        // The userHandle will be the name of the uploader in puu requests
        const previousNotificationHandle = previousNotification.userHandle;
        const currentNotificationHandle = currentNotification.userHandle;
        if (currentNotificationHandle !== previousNotificationHandle) {
            return false;
        }

        // Make sure that neither notification has been deleted
        const previousNotificationNode = M.d[previousNotification.data.h];
        const currentNotificationNode = M.d[currentNotification.data.h];
        if (!previousNotificationNode || !currentNotificationNode) {
            return false;
        }

        // Make sure that both notifications are going into the same folder
        if (previousNotificationNode.p !== currentNotificationNode.p) {
            return false;
        }

        if (previousNotification.seen !== currentNotification.seen) {
            return false;
        }

        // If there is a gap of over 5 minutes between notifications, do not combine them
        if (currentNotification.timestamp - previousNotification.timestamp > 300) {
            return false;
        }

        previousNotification.allDataItems.push(currentNotification.data.h);
        return true;
    },

    /**
     * For incoming action packets, this combines the current new notification with the previous one if it meets
     * certain criteria. To be combined:
     * - There must be a previous notification to actually combine with
     * - It must be a new folder/file added to a share
     * - The user must be the same (same user handle)
     * - The previous notification must be less than 5 minutes old, and
     * - The new notification must be added to the same folder as the previous one.
     * An example put node:
     * {"a":"put","n":"U8oHEL7Q","u":"555wupYjkMU","f":[{"h":"F5QQSDJR","t":0}]}
     * @param {Object} currentNotification The current notification object
     */
    combineNewNotificationWithPrevious: function(currentNotification) {

        'use strict';

        // If there are no previous notifications, nothing can be combined,
        // so add it to start of the list without modification and exit

        // Get the previous notification (list is already sorted by most recent at the top)
        var previousNotification = notify.notifications[0];

        if (!previousNotification) {
            notify.notifications.unshift(currentNotification);
            return false;
        }

        // if prev+curr notifications are not from the same type
        if (currentNotification.type !== previousNotification.type) {
            notify.notifications.unshift(currentNotification);
            return false;
        }

        // We only for now combine "put", "d" (del), and "puu" (file request upload)
        if (currentNotification.type !== 'put' && currentNotification.type !== 'd'
                && currentNotification.type !== 'puu') {
            notify.notifications.unshift(currentNotification);
            return false;
        }

        // If the current notification is not from the same user it cannot be combined
        // so add it to start of the list without modification and exit
        if (previousNotification.userHandle !== currentNotification.userHandle) {
            notify.notifications.unshift(currentNotification);
            return false;
        }

        // If time difference is older than 5 minutes it's a separate event and not worth combining,
        // so add it to start of the list without modification and exit
        if (previousNotification.timestamp - currentNotification.timestamp > 300) {
            notify.notifications.unshift(currentNotification);
            return false;
        }

        // Get details about the current notification
        var currentNotificationParentHandle = currentNotification.data.n;
        var currentNotificationNodes = currentNotification.data.f;

        // Get details about the previous notification
        var previousNotificationParentHandle = previousNotification.data.n;
        var previousNotificationNodes = previousNotification.data.f;


        if (currentNotification.type === 'put') {
            // If parent folders are not the same, they cannot be combined, so
            // add it to start of the list without modification and exit
            if (currentNotificationParentHandle !== previousNotificationParentHandle) {
                notify.notifications.unshift(currentNotification);
                return false;
            }

            // Combine the folder/file nodes from the current notification to the previous one
            var combinedNotificationNodes = previousNotificationNodes.concat(currentNotificationNodes);

            // Replace the current notification's nodes with the combined nodes
            currentNotification.data.f = combinedNotificationNodes;

        }
        else if (currentNotification.type === 'puu') {
            if (previousNotificationParentHandle !== currentNotificationParentHandle){
                notify.notifications.unshift(currentNotification);
                return false;
            }
            if (previousNotification.data.pou !== currentNotification.data.pou) {
                notify.notifications.unshift(currentNotification);
                return false;
            }
            if (previousNotification.seen !== currentNotification.seen) {
                notify.notifications.unshift(currentNotification);
                return false;
            }
            const combinedNotificationNodes = previousNotification.allDataItems
                .concat(currentNotificationNodes.map((e) => e.h));
            currentNotification.data.f = combinedNotificationNodes;
            currentNotification.allDataItems = combinedNotificationNodes;
        }
        else { // it's 'd'

            if (!Array.isArray(previousNotificationParentHandle)) {
                previousNotificationParentHandle = [previousNotificationParentHandle];
            }

            var deletedCombinedNodes = previousNotificationParentHandle.concat(currentNotificationParentHandle);
            currentNotification.data.n = deletedCombinedNodes;
        }

        // Remove the previous notification and add the current notification with combined nodes from the previous
        notify.notifications.shift();
        notify.notifications.unshift(currentNotification);
    },

    /**
     * Counts the new notifications and shows the number of new notifications in a red circle
     */
    countAndShowNewNotifications: function() {

        var newNotifications = 0;
        var $popup = $(notify.$popupNum);

        // Loop through the notifications
        for (var i = 0; i < notify.notifications.length; i++) {

            // If it hasn't been seen yet increment the count
            if (notify.notifications[i].seen === false) {
                // Don't count chat notifications until chat has loaded and can verify them.
                if (notify.notifications[i].type === 'mcsmp') {
                    const { data } = notify.notifications[i];
                    if (megaChatIsReady) {
                        const res = notify.getScheduledNotifOrReject(data);
                        if (
                            res !== false
                            && (res === 0 || !(res.mode === ScheduleMetaChange.MODE.CREATED && data.ou === u_handle))
                        ) {
                            newNotifications++;
                        }
                    }
                }
                else if (notify.notifications[i].type === 'dynamic') {
                    // Do not count expired promotions, if they have an expiration date
                    if ((!notify.notifications[i].data.e || notify.notifications[i].data.e >= unixtime())
                        && notify.notifications[i].data.id > this.lastSeenDynamic) {
                        newNotifications++;
                    }
                }
                else {
                    newNotifications++;
                }
            }
        }

        // If there is a new notification, show the red circle with the number of notifications in it
        if (newNotifications >= 1) {
            $popup.removeClass('hidden').text(newNotifications);
            $(document.body).trigger('onMegaNotification', newNotifications);
        }
        else {
            // Otherwise hide it
            $popup.addClass('hidden').text(newNotifications);
            $(document.body).trigger('onMegaNotification', false);
        }

        // Update page title
        megatitle();
    },

    /**
     * Marks all notifications so far as seen, this will hide the red circle
     * and also make sure on reload these notifications are not new anymore
     * If this is triggered by local, send `sla` request
     *
     * @param {Boolean} [remote] Optional. Show this function triggered by remote action packet.
     */
    markAllNotificationsAsSeen: function(remote) {

        'use strict';

        let newMaxDynamic = false;

        // Loop through the notifications and mark them as seen (read)
        for (var i = 0; i < notify.notifications.length; i++) {
            if (notify.notifications[i].type === 'dynamic') {
                const newId = notify.notifications[i].data.id;
                if (newId > this.lastSeenDynamic) {
                    newMaxDynamic = true;
                    this.lastSeenDynamic = newId;
                }
            }
            notify.notifications[i].seen = true;
        }
        if (newMaxDynamic) {
            mega.attr.set('lnotif', String(this.lastSeenDynamic), -2, true);
        }

        // Hide red circle with number of new notifications
        notify.$popupNum.addClass('hidden');
        notify.$popupNum.html(0);

        // Update page title
        megatitle();

        // Send 'set last acknowledged' API request to inform it which notifications have been seen
        // up to this point then they won't show these notifications as new next time they are fetched
        if (!remote) {
            api.screq('sla').catch(dump);
        }
    },

    /**
     * Open the notifications popup when clicking the notifications icon
     */
    initNotifyIconClickHandler: function() {

        // Add delegated event for when the notifications icon is clicked
        $('.top-head').off('click', '.top-icon.notification');
        $('.top-head').on('click', '.top-icon.notification', function() {

            // If the popup is already open, then close it
            if (!notify.$popup.hasClass('hidden')) {
                notify.closePopup();
            }
            else {
                // Otherwise open the popup
                notify.renderNotifications();
            }
        });


        $('.js-topbarnotification').rebind('click', function() {
            let $elem = $(this).parent();
            if ($elem.hasClass('show')) {
                notify.closePopup();
            }
            else {
                $elem.addClass('show');
                notify.renderNotifications();

                // Check if any dynamic notifications can be seen
                const dynamicNotifIds = [];
                for (const notif of $('.nt-dynamic-notification', notify.$popup)) {
                    dynamicNotifIds.push($(notif).data('dynamic-id'));
                }

                // Send event to the API if any dynamic notifications can be seen
                if (dynamicNotifIds.length) {
                    notify.sendNotifSeenEvent(dynamicNotifIds);
                }
            }
        });
    },

    /**
     * Closes the popup. If the popup is currently open and a) the user clicks onto a new page within Mega or b) clicks
     * outside of the popup then this will mark the notifications as read. If the popup is not open, then functions
     * like $.hideTopMenu will try to hide any popups that may be open, but in this scenario we don't want to mark the
     * notifications as seen/read, we want the number of new notifications to remain in the red tooltip.
     */
    closePopup: function() {
        'use strict';
        if (notify.$popup !== null && this.$popup.closest('.js-dropdown-notification').hasClass('show')) {
            this.$popup.closest('.js-dropdown-notification').removeClass('show');
            notify.markAllNotificationsAsSeen();
        }
        notify.dynamicNotifCountdown.removeDynamicNotifCountdown();
    },

    /**
     * Sort dynamic notifications to be at the top sorted by id, then other notifications by timestamp
     */
    sortNotificationsByMostRecent: function() {
        notify.notifications.sort(function(notificationA, notificationB) {

            if (notificationA.type === 'dynamic' || notificationB.type === 'dynamic') {
                if (notificationB.type !== 'dynamic') {
                    return -1;
                }
                else if (notificationA.type !== 'dynamic') {
                    return 1;
                }

                if (notificationA.data.id > notificationB.data.id) {
                    return -1;
                }
                else if (notificationA.data.id < notificationB.data.id) {
                    return 1;
                }
                return 0;
            }
            else {
                if (notificationA.timestamp > notificationB.timestamp) {
                    return -1;
                }
                else if (notificationA.timestamp < notificationB.timestamp) {
                    return 1;
                }
                return 0;
            }
        });
    },

    /**
     * Populates the user emails into a list which can be looked up later for incoming
     * notifications where there is no known contact handle e.g. pending shares/contacts
     * @param {Array} pendingContactUsers An array of objects (with user handle and email) for the pending contacts
     */
    addUserEmails: function(pendingContactUsers) {
        'use strict';

        // Add the pending contact email addresses
        if (Array.isArray(pendingContactUsers)) {

            for (var i = pendingContactUsers.length; i--;) {

                var userHandle = pendingContactUsers[i].u;
                var userEmail = pendingContactUsers[i].m;

                notify.userEmails[userHandle] = userEmail;
            }
        }
    },

    /**
     * Retrieve the email associated to a user by his/their handle or from the optional notification data
     * @param {String} userHandle the user handle to fetch the email for
     * @param {Object} [data] Optional the notification data
     * @param {boolean} [skipFetch] Optional to not use this function to sync the user data
     * @returns {string|false} The email if found or false if fetching data (or skipped by skipFetch)
     */
    getUserEmailByTheirHandle: function(userHandle, data, skipFetch) {
        'use strict';
        if (typeof userHandle !== 'string' || userHandle.length !== 11) {
            return l[7381];
        }
        if (typeof this.userEmails[userHandle] === 'string' && this.userEmails[userHandle]) {
            // Previously found and not an empty string.
            return this.userEmails[userHandle];
        }
        const userEmail = M.getUserByHandle(userHandle).m;
        if (userEmail) {
            // Found in M.u
            return userEmail;
        }
        if (data && data.m) {
            // Found on notification data
            return data.m;
        }
        if (skipFetch || (this.userEmails[userHandle] instanceof Promise)) {
            return false;
        }
        // Fetch data from API
        M.setUser(userHandle);
        const promises = [
            M.syncUsersFullname(userHandle),
            M.syncContactEmail(userHandle, true)
        ];
        this.userEmails[userHandle] = Promise.allSettled(promises)
            .then(() => {
                this.userEmails[userHandle] = M.getUserByHandle(userHandle).m;
            });
        return false;
    },

    /**
     * To do: render the notifications in the popup
     */
    renderNotifications: function() {
        'use strict';

        // Get the number of notifications
        var numOfNotifications = notify.notifications.length;
        var allNotificationsHtml = '';

        // If no notifications, show empty
        if (notify.initialLoadComplete && numOfNotifications === 0) {
            notify.$popup.removeClass('loading');
            notify.$popup.addClass('empty');
            return false;
        }
        else if (!notify.initialLoadComplete) {
            return false;
        }

        // Sort the notifications
        notify.sortNotificationsByMostRecent();

        // Reset rendered contact requests so the Accept button will show again
        notify.renderedContactRequests = [];

        // Cache the template selector
        var $template = this.$popup.find('.notification-item.template');

        // Remove existing notifications and so they are re-rendered
        this.$popup.find('.notification-item:not(.template)').remove();

        // Loop through all the notifications
        for (var i = 0; i < numOfNotifications; i++) {

            // Get the notification data and clone the notification template in /html/top.html
            var notification = notify.notifications[i];
            var $notificationHtml = $template.clone();

            // Update template
            $notificationHtml = notify.updateTemplate($notificationHtml, notification);

            // Skip this notification if it's not one that is recognised
            if ($notificationHtml === false) {
                continue;
            }

            // Build the html
            allNotificationsHtml += $notificationHtml.prop('outerHTML');
        }

        // If all notifications are not recognised, show empty
        if (allNotificationsHtml === "") {
            notify.$popup.removeClass('loading');
            notify.$popup.addClass('empty');
            return false;
        }

        // Update the list of notifications
        notify.$popup.find('.notification-scr-list').safeAppend(allNotificationsHtml);
        notify.$popup.removeClass('empty loading');

        // Add scrolling for the notifications
        Soon(() => {
            initPerfectScrollbar($('.notification-scroll', notify.$popup));
        });

        // Add click handlers for various notifications
        notify.initFullContactClickHandler();
        notify.initShareClickHandler();
        notify.initTakedownClickHandler();
        notify.initPaymentClickHandler();
        notify.initPaymentReminderClickHandler();
        notify.initAcceptContactClickHandler();
        notify.initSettingsClickHander();
        notify.initScheduledClickHandler();
        notify.initDynamicClickHandler();

        // Initialise countdown timer for dynamic notifications with expiry dates
        if (this.$popup.closest('.js-dropdown-notification').hasClass('show')) {
            notify.dynamicNotifCountdown.startTimer();
        }
    },

    /**
     * When the other user has accepted the contact request and the 'Contact relationship established' notification
     * appears, make this is clickable so they can go to the contact's page to verify fingerprints or start chatting.
     */
    initFullContactClickHandler: function() {

        // Add click handler for the 'Contact relationship established' notification
        this.$popup.find('.nt-contact-accepted').rebind('click', function() {
            // Redirect to the contact's page only if it's still a contact
            if (M.c.contacts && $(this).attr('data-contact-handle') in M.c.contacts) {
                loadSubPage('fm/chat/contacts/' + $(this).attr('data-contact-handle'));
                notify.closePopup();
            } else {
                msgDialog('info', '', l[20427]);
            }
        });
        clickURLs();
        $('a.clickurl', this.$popup).rebind('click.notif', () => notify.closePopup());
    },

    /**
     * On click of a share or new files/folders notification, go to that share
     */
    initShareClickHandler: function() {

        // Select the notifications with shares or new files/folders
        this.$popup.find('.notification-item.nt-incoming-share, .notification-item.nt-new-files').rebind('click', function() {

            // Get the folder ID from the HTML5 data attribute
            const $this = $(this);
            const folderId = $this.attr('data-folder-id');
            const notificationID = $this.attr('id');

            // Mark all notifications as seen and close the popup
            // (because they clicked on a notification within the popup)
            notify.closePopup();

            // Open the folder
            M.openFolder(folderId)
                .then(() => {
                    const {allDataItems, data: {f}} = notify.notifications.find(elem => elem.id === notificationID);

                    M.addSelectedNodes(allDataItems || f && f.map((n) => n.h) || [], true);
                })
                .catch(dump);
        });
    },

    /**
     * On click of a takedown or restore notice, go to the parent folder
     */
    initTakedownClickHandler: function() {

        // Select the notifications with shares or new files/folders
        this.$popup.find('.nt-takedown-notification, .nt-takedown-reinstated-notification').rebind('click', function() {

            // Get the folder ID from the HTML5 data attribute
            var folderOrFileId = $(this).attr('data-folder-or-file-id');
            var parentFolderId = M.getNodeByHandle(folderOrFileId).p;

            // Mark all notifications as seen and close the popup
            // (because they clicked on a notification within the popup)
            notify.closePopup();

            if (parentFolderId) {
                // Open the folder
                M.openFolder(parentFolderId)
                    .always(function() {
                        reselect(true);
                    });
            }
        });
    },

    /**
     * If they click on a payment notification, then redirect them to the Account History page
     */
    initPaymentClickHandler: function() {

        // On payment notification click
        this.$popup.find('.notification-item.nt-payment-notification').rebind('click', function() {

            // Mark all notifications as seen (because they clicked on a notification within the popup)
            notify.closePopup();
            var $target = $('.data-block.account-balance');

            // Redirect to payment history
            loadSubPage('fm/account/plan');
            mBroadcaster.once('settingPageReady', function () {
                const $scrollBlock = $('.fm-right-account-block.ps');
                if ($scrollBlock.length) {
                    $scrollBlock.scrollTop(
                        $target.offset().top - $scrollBlock.offset().top + $scrollBlock.scrollTop()
                    );
                }
            });
        });
    },

    /**
     * If they click on a payment reminder notification, then redirect them to the Pro page
     */
    initPaymentReminderClickHandler: function() {

        // On payment reminder notification click
        this.$popup.find('.notification-item.nt-payment-reminder-notification').rebind('click', function() {

            // Mark all notifications as seen and close the popup
            // (because they clicked on a notification within the popup)
            notify.closePopup();

            // Redirect to pro page
            loadSubPage('pro');
        });
    },

    /**
     * If the click on Accept for a contact request, accept the contact
     */
    initAcceptContactClickHandler: function() {

        // Add click handler to Accept button
        this.$popup.find('.notification-item .notifications-button.accept').rebind('click', function() {

            var $this = $(this);
            var pendingContactId = $this.attr('data-pending-contact-id');

            // Send the User Pending Contact Action (upca) API 2.0 request to accept the request
            M.acceptPendingContactRequest(pendingContactId)
                .catch(() => {
                    notify.acceptedContactRequests.splice(notify.acceptedContactRequests.indexOf(pendingContactId), 1);
                });

            // Show the Accepted icon and text
            $this.closest('.notification-item').addClass('accepted');
            notify.acceptedContactRequests.push(pendingContactId);

            // Mark all notifications as seen and close the popup
            // (because they clicked on a notification within the popup)
            notify.closePopup();
        });
    },

    /**
     * Load the notification settings page
     * @return {undefined}
     */
    initSettingsClickHander: function() {
        'use strict';
        $('button.settings', this.$popup).rebind('click.notifications', () => {
            notify.closePopup();
            loadSubPage('fm/account/notifications');
        });
    },

    initScheduledClickHandler: () => {
        'use strict';
        $('.nt-schedule-meet', this.$popup).rebind('click.notifications', e => {
            const chatId = $(e.currentTarget).attr('data-chatid');
            if (chatId) {
                notify.closePopup();
                loadSubPage(`fm/chat/${chatId}`);
                if ($(e.currentTarget).attr('data-desc') === '1') {
                    delay(`showSchedDescDialog-${chatId}`, () => {
                        megaChat.chats[chatId].trigger('openSchedDescDialog');
                    }, 1500);
                }
            }
        });
    },

    initDynamicClickHandler: () => {
        'use strict';
        $('.nt-dynamic-notification', this.$popup).rebind('click.notifications', e => {
            const dynamicId = $(e.currentTarget).attr('data-dynamic-id');
            const ctaButton = notify.dynamicNotifs[dynamicId].cta1 || notify.dynamicNotifs[dynamicId].cta2;
            if (ctaButton && ctaButton.link) {
                notify.closePopup();
                const link = ctaButton.link;
                if (link) {
                    window.open(link, '_blank', 'noopener,noreferrer');
                }
                eventlog(500242, dynamicId | 0);
            }
        });
    },

    /**
     * Main function to update each notification with relevant style and details
     * @param {Object} $notificationHtml The jQuery clone of the HTML notification template
     * @param {Object} notification The notification object
     * @returns {Object}
     */
    updateTemplate: function($notificationHtml, notification)
    {
        // Remove the template class
        $notificationHtml.removeClass('template');

        var date = time2last(notification.timestamp);
        var data = notification.data;
        var userHandle = notification.userHandle;
        var userEmail = l[7381];    // Unknown
        var avatar = '';

        // Payment & Takedown notification types, file-request upload type
        const customIconNotifications = ['psts', 'pses', 'ph', 'puu', 'dynamic'];

        // If a contact action packet
        if (typeof userHandle !== 'string') {
            if (Array.isArray(userHandle)) {
                userHandle = userHandle[0] || false;
            }
            if (typeof userHandle !== 'object' && data) {
                userHandle = Array.isArray(data.u) && data.u[0] || data;
            }
            userEmail = userHandle.m || userEmail;
            userHandle = userHandle.u || userHandle.ou;
        }

        // Use the email address in the notification/action packet if the contact doesn't exist locally
        // or if it was populated partially locally (i.e from chat, without email)
        // or if the notification is closed account notification, M.u cannot be exist, so just using attached email.
        if (userEmail === l[7381]) {
            let email = data && data.m;
            if (userHandle) {
                email = this.getUserEmailByTheirHandle(userHandle, data);
                if (!email) {
                    return false; // Fetching user attributes...
                }
            }
            userEmail = email || userEmail;
        }

        // If the notification is not one of the custom ones, generate an avatar from the user information
        if (customIconNotifications.indexOf(notification.type) === -1) {

            // Generate avatar from the user handle which will load their profile pic if they are already a contact
            if (typeof M.u[userHandle] !== 'undefined') {
                avatar = useravatar.contact(userHandle);
            }

            // If it failed to generate an avatar from the user handle, or we haven't generated one yet use the email
            // address. With the new v2.0 API for pending contacts, the user handle will usually not be available as
            // they are not a full contact yet.
            if (avatar === '') {
                avatar = useravatar.contact(userEmail);
            }

            // Add the avatar HTML and show it
            $notificationHtml.find('.notification-avatar').removeClass('hidden').prepend(avatar);
        }
        else {
            // Hide the notification avatar code, the specific notification will render the icon
            $notificationHtml.find('.notification-icon').removeClass('hidden');
        }

        // Get the user's name if we have it, otherwise use their email
        var displayNameOrEmail = notify.getDisplayName(userEmail);

        // Update common template variables
        $notificationHtml.attr('id', notification.id);
        $notificationHtml.find('.notification-date').text(date);
        $notificationHtml.find('.notification-username').text(displayNameOrEmail);

        // Add read status
        if (notification.seen) {
            $notificationHtml.addClass('read');
        }

        // Populate other information based on each type of notification
        switch (notification.type) {
            case 'ipc':
                return notify.renderIncomingPendingContact($notificationHtml, notification);
            case 'c':
                return notify.renderContactChange($notificationHtml, notification);
            case 'upci':
                return notify.renderUpdatedPendingContactIncoming($notificationHtml, notification);
            case 'upco':
                return notify.renderUpdatedPendingContactOutgoing($notificationHtml, notification);
            case 'share':
                return notify.renderNewShare($notificationHtml, notification, userEmail);
            case 'd':
                return notify.renderRemovedSharedNode($notificationHtml, notification);
            case 'dshare':
                return notify.renderDeletedShare($notificationHtml, userEmail, notification);
            case 'put':
                return notify.renderNewSharedNodes($notificationHtml, notification, userEmail);
            case 'psts':
                return notify.renderPayment($notificationHtml, notification);
            case 'pses':
                return notify.renderPaymentReminder($notificationHtml, notification);
            case 'ph':
                return notify.renderTakedown($notificationHtml, notification);
            case 'dynamic':
                return notify.renderDynamic($notificationHtml, notification);
            case 'mcsmp': {
                if (!window.megaChat || !window.megaChat.is_initialized) {
                    return false;
                }
                return notify.renderScheduled($notificationHtml, notification);
            }
            case 'puu':
                return notify.renderFileRequestUpload($notificationHtml, notification);
            default:
                return false;   // If it's a notification type we do not recognise yet
        }
    },

    /**
     * Render pending contact requests
     * @param {Object} $notificationHtml jQuery object of the notification template HTML
     * @param {Object} notification
     * @returns {Object} The HTML to be rendered for the notification
     */
    renderIncomingPendingContact: function($notificationHtml, notification) {

        var pendingContactId = notification.data.p;
        var mostRecentNotification = true;
        let isAccepted = false;
        var className = '';
        var title = '';

        // Check if a newer contact request for this user has already been rendered (notifications are sorted by timestamp)
        for (var i = 0, length = notify.renderedContactRequests.length; i < length; i++) {

            // If this contact request has already been rendered, don't render the current notification with buttons
            if (pendingContactId === notify.renderedContactRequests[i]) {
                mostRecentNotification = false;
            }
        }

        if (notify.acceptedContactRequests.includes(pendingContactId)) {
            isAccepted = true;
        }
        // If this is the most recent contact request from this user
        if (mostRecentNotification && !isAccepted) {

            // If this IPC notification also exists in the state
            if (typeof M.ipc[pendingContactId] === 'object') {

                // Show the Accept button
                $notificationHtml.find('.notification-request-buttons').removeClass('hidden');
            }

            // Set a flag so the buttons are not rendered again on older notifications
            notify.renderedContactRequests.push(pendingContactId);
        }

        // If the other user deleted their contact request to the current user
        if (typeof notification.data.dts !== 'undefined') {
            className = 'nt-contact-deleted';
            title = l[7151];      // Cancelled their contact request
        }

        // If the other user sent a reminder about their contact request
        else if (typeof notification.data.rts !== 'undefined') {
            className = 'nt-contact-request';
            title = l[7150];      // Reminder: you have a contact request
        }
        else {
            // Creates notification with 'Sent you a contact request' and 'Accept' button
            className = 'nt-contact-request';
            title = l[5851];
        }

        // Populate other template information
        $notificationHtml.addClass(className);
        if (notification.data && notification.data.m) {
            const user = M.getUserByEmail(notification.data.m);
            if (user && user.c === 1 && user.h) {
                $notificationHtml.addClass('clickurl').attr('href', `/fm/chat/contacts/${user.h}`);
            }
            else if (isAccepted) {
                // In-flight request so user.h is unknown. Send to contacts on click
                $notificationHtml.addClass('clickurl').attr('href', `/fm/chat/contacts`);
            }
        }
        $notificationHtml.find('.notification-info').text(title);
        $notificationHtml.find('.notifications-button.accept').attr('data-pending-contact-id', pendingContactId);

        return $notificationHtml;
    },

    /**
     * Renders notifications related to contact changes
     * @param {Object} $notificationHtml jQuery object of the notification template HTML
     * @param {Object} notification
     * @returns {Object} The HTML to be rendered for the notification
     */
    renderContactChange: function($notificationHtml, notification) {

        // Get data from initial c=50 notification fetch or action packet
        var action = (typeof notification.data.c !== 'undefined') ? notification.data.c : notification.data.u[0].c;
        var userHandle = (Array.isArray(notification.userHandle)) ?
            notification.data.ou || notification.userHandle[0].u : notification.userHandle;
        var className = '';
        var title = '';

        // If the user deleted the request
        if (action === 0) {
            className = 'nt-contact-deleted';
            title = l[7146];        // Deleted you as a contact
        }
        else if (action === 1) {
            className = 'nt-contact-accepted';
            title = l.notification_contact_accepted; // Accepted your contact request

            if (u_attr.b && !u_attr.b.m && u_attr.b.mu && u_attr.b.mu[0] === userHandle) {
                title = l.admin_sub_contacts; // your admin and you are now contacts.
            }

            // Add a data attribute for the click handler
            $notificationHtml.attr('data-contact-handle', userHandle);
            $notificationHtml.addClass('clickable');
        }
        else if (action === 2) {
            className = 'nt-contact-deleted';
            title = l[7144];        // Account has been deleted/deactivated
        }
        else if (action === 3) {
            className = 'nt-contact-request-blocked';
            title = l[7143];        // Blocked you as a contact
        }

        // Populate other template information
        $notificationHtml.addClass(className);
        $notificationHtml.find('.notification-info').text(title);

        return $notificationHtml;
    },

    /**
     * Renders Updated Pending Contact (Incoming) notifications
     * @param {Object} $notificationHtml jQuery object of the notification template HTML
     * @param {Object} notification
     * @returns {Object} The HTML to be rendered for the notification
     */
    renderUpdatedPendingContactIncoming: function($notificationHtml, notification) {

        // The action 's' will only be available if initial fetch of notifications, 'u[0].s' is used if action packet
        var action = (typeof notification.data.s !== 'undefined') ? notification.data.s : notification.data.u[0].s;
        var className = '';
        var title = '';

        if (action === 1) {
            className = 'nt-contact-request-ignored';
            title = l[7149];      // You ignored a contact request
        }
        else if (action === 2) {
            className = 'nt-contact-accepted';
            title = l[7148];      // You accepted a contact request
        }
        else if (action === 3) {
            className = 'nt-contact-request-denied';
            title = l[7147];      // You denied a contact request
        }

        // Populate other template information
        $notificationHtml.addClass(className);
        $notificationHtml.find('.notification-info').text(title);

        return $notificationHtml;
    },

    /**
     * Renders Updated Pending Contact (Outgoing) notifications
     * @param {Object} $notificationHtml jQuery object of the notification template HTML
     * @param {Object} notification
     * @returns {Object} The HTML to be rendered for the notification
     */
    renderUpdatedPendingContactOutgoing: function($notificationHtml, notification) {

        // The action 's' will only be available if initial fetch of notifications, 'u[0].s' is used if action packet
        var action = (typeof notification.data.s !== 'undefined') ? notification.data.s : notification.data.u[0].s;
        var className = '';
        var title = '';

        // Display message depending on action
        if (action === 2) {
            className = 'nt-contact-accepted';
            title = l[5852];        // Accepted your contact request
        }
        else if (action === 3) {
            className = 'nt-contact-request-denied';
            title = l[5853];        // Denied your contact request
        }

        // Populate other template information
        $notificationHtml.addClass(className);
        $notificationHtml.find('.notification-info').text(title);

        return $notificationHtml;
    },

    /**
     * Render new share notification
     * @param {Object} $notificationHtml jQuery object of the notification template HTML
     * @param {Object} notification
     * @param {String} email The email address
     * @returns {Object} The HTML to be rendered for the notification
     */
    renderNewShare: function($notificationHtml, notification, email) {

        var title = '';
        var folderId = notification.data.n;

        // If the email exists use language string 'New shared folder from [X]'
        if (email) {
            title = l[824].replace('[X]', email);
        }
        else {
            // Otherwise use string 'New shared folder'
            title = l[825];
        }

        // Populate other template information
        $notificationHtml.addClass('nt-incoming-share');
        $notificationHtml.addClass('clickable');
        $notificationHtml.find('.notification-info').text(title);
        $notificationHtml.attr('data-folder-id', folderId);

        return $notificationHtml;
    },

    /**
     * Render removed share node notification
     * @param {Object} $notificationHtml jQuery object of the notification template HTML
     * @returns {Object} The HTML to be rendered for the notification
     */
    renderRemovedSharedNode: function($notificationHtml, notification) {

        var itemsNumber = 0;
        var title = '';

        if (Array.isArray(notification.data.n)) {
            itemsNumber = notification.data.n.length;
        }
        else {
            itemsNumber = 1;
        }

        title = mega.icu.format(l[8913], itemsNumber);

        // Populate other template information
        $notificationHtml.addClass('nt-revocation-of-incoming');
        $notificationHtml.find('.notification-info').text(title);

        return $notificationHtml;
    },

    /**
     * Render a deleted share notification
     * @param {Object} $notificationHtml jQuery object of the notification template HTML
     * @param {String} email The email address
     * @param {Object} notification notification object
     * @returns {Object} The HTML to be rendered for the notification
     */
    renderDeletedShare: function ($notificationHtml, email, notification) {

        var title = '';
        var notificationOwner;
        var notificationTarget;
        var notificationOrginating;

        // first we are parsing an action packet.
        if (notification.data.orig) {
            notificationOwner = notification.data.u;
            notificationTarget = notification.data.rece;
            notificationOrginating = notification.data.orig;
        }
        else {
            // otherwise we are parsing 'c' api response (initial notifications request)
            notificationOwner = notification.data.o;
            notificationOrginating = notification.data.u;
            if (notificationOwner === u_handle) {
                if (notificationOrginating === u_handle) {
                    console.error('receiving a wrong notification, this notification shouldnt be sent to me',
                        notification
                    );
                }
                else {
                    notificationTarget = notificationOrginating;
                }
            }
            else {
                notificationTarget = u_handle;
            }

            // if we are dealing with old notification which doesnt support the new data
            if (!notificationOwner || notificationOwner === -1) {
                // fall back to the old not correct notification
                notificationOwner = notificationOrginating;
            }
            // receiving old action packet
            // .rece without .orig
            if (notification.data.rece) {
                notificationOwner = notificationOrginating;
            }

        }
        var sharingRemovedByReciver = notificationOrginating !== notificationOwner;

        if (!sharingRemovedByReciver) {
            // If the email exists use string 'Access to folders shared by [X] was removed'
            if (email) {
                title = l[7879].replace('[X]', email);
            }
            else {
                // Otherwise use string 'Access to folders was removed.'
                title = l[7880];
            }
        }
        else {
            var folderName = M.getNameByHandle(notification.data.n) || '';
            var removerEmail = notify.getUserEmailByTheirHandle(notificationTarget);
            if (removerEmail) {
                title = l[19153].replace('{0}', removerEmail).replace('{1}', folderName);
            }
            else {
                title = l[19154].replace('{0}', folderName);
            }
        }

        // Populate other template information
        $notificationHtml.addClass('nt-revocation-of-incoming');
        $notificationHtml.find('.notification-info').text(title);

        return $notificationHtml;
    },

    /**
     * Render a notification for when another user has added files/folders into an already shared folder.
     * This condenses all the files and folders that were shared into a single notification.
     * @param {Object} $notificationHtml jQuery object of the notification template HTML
     * @param {Object} notification
     * @param {String} email The email address
     * @returns {Object} The HTML to be rendered for the notification
     */
    renderNewSharedNodes: function($notificationHtml, notification, email) {

        var nodes = notification.data.f;
        var fileCount = 0;
        var folderCount = 0;
        var folderId = notification.data.n;
        var notificationText = '';
        var title = '';

        // Count the number of new files and folders
        for (var node in nodes) {

            // Skip if not own property
            if (!nodes.hasOwnProperty(node)) {
                continue;
            }

            // If folder, increment
            if (nodes[node].t) {
                folderCount++;
            }
            else {
                // Otherwise is file
                fileCount++;
            }
        }

        // Get wording for the number of files and folders added
        const folderText = mega.icu.format(l.folder_count, folderCount);
        const fileText = mega.icu.format(l.file_count, fileCount);

        // Set wording of the title
        if (folderCount >= 1 && fileCount >= 1) {
            title = email ? mega.icu.format(l.user_item_added_count, folderCount + fileCount).replace('[X]', email) :
                mega.icu.format(l.item_added_count, folderCount + fileCount);
        }
        else if (folderCount > 0) {
            title = email ? l[836].replace('[X]', email).replace('[DATA]', folderText) :
                mega.icu.format(l.folder_added_count, folderCount);
        }
        else if (fileCount > 0) {
            title = email ? l[836].replace('[X]', email).replace('[DATA]', fileText) :
                mega.icu.format(l.file_added_count, fileCount);
        }

        // Populate other template information
        $notificationHtml.addClass('nt-new-files');
        $notificationHtml.addClass('clickable');
        $notificationHtml.find('.notification-info').text(title);
        $notificationHtml.attr('data-folder-id', folderId);

        return $notificationHtml;
    },

    /**
     * Process payment notification sent from payment provider e.g. Bitcoin.
     * @param {Object} $notificationHtml jQuery object of the notification template HTML
     * @param {Object} notification The notification object
     * @returns {Object} The HTML to be rendered for the notification
     */
    renderPayment: function($notificationHtml, notification) {

        // If user has not seen the welcome dialog before, show it and set ^!welDlg to 2 (seen)
        if (!notification.seen && !(u_attr.pf || u_attr.b)) {
            mega.attr.get(u_handle, 'welDlg', -2, 1, (res) => {
                if ((res | 0) === 1) {
                    notify.createNewUserDialog(notification);
                    notify.welcomeDialogShown = true;
                    mega.attr.set('welDlg', 2, -2, true);
                }
            }).catch(dump);
        }

        var proLevel = notification.data.p;
        var proPlan = pro.getProPlanName(proLevel);
        var success = (notification.data.r === 's') ? true : false;
        var header = l[1230];   // Payment info
        var title = '';

        // Change wording depending on success or failure
        if (success) {
            title = l[7142].replace('%1', proPlan);   // Your payment for the PRO III plan was received.
        }
        else {
            title = l[7141].replace('%1', proPlan);   // Your payment for the PRO II plan was unsuccessful.
        }

        // Populate other template information
        $notificationHtml.addClass('nt-payment-notification');
        $notificationHtml.addClass('clickable');
        $notificationHtml.find('.notification-info').text(title);
        $notificationHtml.find('.notification-username').text(header);      // Use 'Payment info' instead of an email

        return $notificationHtml;
    },

    createNewUserDialog: tryCatch(() => {
        'use strict';

        const $dialog = $('.mega-dialog-container .upgrade-welcome-dialog');

        M.accountData((account) => {

            account.purchases.sort((a, b) => {
                if (a[1] < b[1]) {
                    return 1;
                }
                return -1;
            });

            let purchaseEndTime;
            const getPlansEndingAfterPurchase = () => {
                let plansEndingAfterSubscription = 0;
                account.purchases.forEach(purchase => {
                    const days = purchase[6] === 1
                        ? 32
                        : purchase[6] === 12
                            ? 367
                            : purchase[6] * 31;
                    const purchaseEnd = days * 86400 + purchase[1];

                    if (((Date.now() / 1000) < purchaseEnd) && ((u_attr.p % 4) <= purchase[5])) {
                        purchaseEndTime = purchaseEnd;
                        plansEndingAfterSubscription++;
                    }
                });
                return plansEndingAfterSubscription;
            };

            // If a user is currently on a higher tier plan than their new plan, inform them that the new plan
            // will be active after their current plan expires
            if (account.purchases[0][5] !== u_attr.p) {
                const currentPlan = pro.getProPlanName(u_attr.p);
                const newPlan = pro.getProPlanName(account.purchases[0][5]);
                const plansEndingAfterPurchase = getPlansEndingAfterPurchase();
                const bodyText = plansEndingAfterPurchase < 2
                    ? l.welcome_dialog_active_until
                    : l.welcome_dialog_active_check;
                msgDialog('warninga', '',
                          l.welcome_dialog_thanks_for_sub.replace('%1', newPlan),
                          bodyText
                              .replace('%1', currentPlan)
                              .replace('%3', time2date(purchaseEndTime || account.srenew, 1))
                              .replace('%2', newPlan));
                return;
            }

            pro.loadMembershipPlans(() => {

                const plan = pro.getPlanObj(account.purchases[0][5], account.purchases[0][6]);

                $('header', $dialog).text(l.welcome_dialog_header.replace('%1', plan.name));
                $('.more-quota .info-text', $dialog).text(l.welcome_dialog_quota_details
                    .replace('%1', bytesToSize(plan.storage, 3, 4))
                    .replace('%2', bytesToSize(plan.transfer, 3, 4)));
                $('button', $dialog).rebind('click', () => {
                    closeDialog();
                });
                M.safeShowDialog('upgrade-welcome-dialog', $dialog);
            });
        });
    }),

    /**
     * Process payment reminder notification to remind them their PRO plan is due for renewal.
     * Example PSES (Pro Status Expiring Soon) packet: {"a":"pses", "ts":expirestimestamp}.
     * @param {Object} $notificationHtml jQuery object of the notification template HTML
     * @param {Object} notification The notification object
     * @returns {Object|false} The HTML to be rendered for the notification
     */
    renderPaymentReminder: function($notificationHtml, notification) {

        // Find the time difference between the current time and the plan expiry time
        var currentTimestamp = unixtime();
        var expiringTimestamp = notification.data.ts;
        var secondsDifference = (expiringTimestamp - currentTimestamp);

        // If the notification is still in the future
        if (secondsDifference > 0) {

            // Calculate day/days remaining
            var days = Math.floor(secondsDifference / 86400);

            // PRO membership plan expiring soon
            // Your PRO membership plan will expire in 1 day/x days.
            var header = l[8598];
            var title;
            if (days === 0) {
                title = l[25041];
            }
            else {
                title = mega.icu.format(l[8597], days);
            }

            // Populate other template information
            $notificationHtml.addClass('nt-payment-reminder-notification clickable');
            $notificationHtml.find('.notification-username').text(header);
            $notificationHtml.find('.notification-info').addClass('red').text(title);

            return $notificationHtml;
        }

        // Don't show any notification if the time has passed
        return false;
    },

    /**
     * Processes a takedown notice or counter-notice to restore the file.
     * @param {Object} $notificationHtml jQuery object of the notification template HTML
     * @param {Object} notification The notification object
     * @returns {Object|false} The HTML to be rendered for the notification
     */
    renderTakedown: function($notificationHtml, notification) {

        var header = '';
        var title = '';
        var cssClass = '';
        var handle = notification.data.h;
        var node = M.d[handle] || {};
        var name = (node.name) ? '(' + notify.shortenNodeName(node.name) + ')' : '';

        // Takedown notice
        // Your publicly shared %1 (%2) has been taken down.
        if (notification.data.down === 1) {
            header = l[8521];
            title = (node.t === 0) ? l.publicly_shared_file_taken_down.replace('%1', name)
                : l.publicly_shared_folder_taken_down.replace('%1', name);
            cssClass = 'nt-takedown-notification';
        }

        // Takedown reinstated
        // Your taken down %1 (%2) has been reinstated.
        else if (notification.data.down === 0) {
            header = l[8524];
            title = (node.t === 0) ? l.taken_down_file_reinstated.replace('%1', name)
                : l.taken_down_folder_reinstated.replace('%1', name);
            cssClass = 'nt-takedown-reinstated-notification';
        }
        else {
            // Not applicable so don't return anything or it will show a blank notification
            return false;
        }

        // Populate other template information
        $notificationHtml.addClass(cssClass);
        $notificationHtml.addClass('clickable');
        $notificationHtml.find('.notification-info').text(title);
        $notificationHtml.find('.notification-username').text(header);
        $notificationHtml.attr('data-folder-or-file-id', handle);

        return $notificationHtml;
    },

    getScheduledNotifOrReject(data) {
        'use strict';

        const chatRoom = megaChat.chats[data.cid];
        if (!chatRoom) {
            return false;
        }

        if (data && data.cs && Array.isArray(data.cs.c) && $.len(data.cs) === 1 && data.cs.c[1] === 0) {
            // Only change we see is that the meeting is no longer cancelled so ignore it.
            return false;
        }
        const meta = megaChat.plugins.meetingsManager.getFormattingMeta(data.id, data, chatRoom);
        if (meta.ap || meta.gone) {
            // If the ap flag is set the occurrence state is not known.
            // A future render should be able to get past this step when all occurrences are known
            // If the gone flag is set then the occurrence no longer exists so skip it.
            return meta.gone ? false : 0;
        }

        const { MODE } = ScheduleMetaChange;

        if (meta.occurrence && meta.mode === MODE.CANCELLED && !$.len(meta.timeRules)) {
            const meeting = megaChat.plugins.meetingsManager.getMeetingOrOccurrenceParent(meta.handle);
            if (!meeting) {
                return false;
            }
            const occurrences = meeting.getOccurrencesById(meta.handle);
            if (!occurrences) {
                return false;
            }
            meta.timeRules.startTime = Math.floor(occurrences[0].start / 1000);
            meta.timeRules.endTime = Math.floor(occurrences[0].end / 1000);
        }

        return meta;
    },

    renderScheduled: function($notificationHtml, notification) {
        'use strict';
        const { data } = notification;

        const meta = this.getScheduledNotifOrReject(data);
        if (!meta) {
            return false;
        }

        const chatRoom = megaChat.chats[data.cid];
        let now;
        let prev;
        const { MODE } = ScheduleMetaChange;
        if (meta.mode === MODE.CREATED && data.ou === u_handle) {
            return false;
        }

        if (meta.timeRules.startTime && meta.timeRules.endTime) {
            const prevMode = meta.mode;
            if (!meta.recurring && prevMode !== MODE.CANCELLED) {
                // Fake the mode for one-off meetings to get the correct time string.
                meta.mode = MODE.EDITED;
            }
            [now, prev] = megaChat.plugins.meetingsManager.getOccurrenceStrings(meta);
            meta.mode = prevMode;
        }

        const $notifBody = $('.notification-scheduled-body', $notificationHtml);
        $notifBody.removeClass('hidden');
        const $notifLabel = $('.notification-content .notification-info', $notificationHtml).eq(0);

        const { NOTIF_TITLES } = megaChat.plugins.meetingsManager;
        let showTitle = true;

        const titleSelect = (core) => {
            const occurrenceKey = meta.occurrence ? 'occur' : 'all';
            if (meta.mode === MODE.CREATED) {
                return core.inv;
            }
            else if (meta.mode === MODE.EDITED) {
                let string = '';
                let diffCounter = 0;
                if (
                    meta.prevTiming
                    && (
                        meta.timeRules.startTime !== meta.prevTiming.startTime
                        || meta.timeRules.endTime !== meta.prevTiming.endTime
                        || (
                            meta.recurring
                            && !megaChat.plugins.meetingsManager.areMetaObjectsSame(meta.timeRules, meta.prevTiming)
                        )
                    )
                    || (meta.occurrence && meta.mode !== MODE.CANCELLED)
                ) {
                    string = core.time[occurrenceKey];
                    diffCounter++;
                }
                if (meta.topicChange) {
                    string = core.name.update.replace('%1', meta.oldTopic).replace('%s', meta.topic);
                    diffCounter++;
                    showTitle = false;
                }
                if (meta.description) {
                    string = core.desc.update;
                    diffCounter++;
                    $notificationHtml.attr('data-desc', diffCounter);
                }
                if (meta.converted) {
                    string = core.convert;
                }
                else if (diffCounter > 1) {
                    string = core.multi;
                    now = false;
                    prev = false;
                    showTitle = true;
                }
                return string;
            }
            return core.cancel[occurrenceKey];
        };

        if (meta.mode === MODE.CREATED) {
            let email = this.getUserEmailByTheirHandle(data.ou);
            if (email) {
                const avatar = useravatar.contact(email);
                if (avatar) {
                    const $avatar = $('.notification-avatar', $notificationHtml).removeClass('hidden');
                    $avatar.empty();
                    $avatar.safePrepend(avatar);
                }
                email = this.getDisplayName(email);
                $('.notification-username', $notificationHtml).text(email);
            }
        }

        $notifLabel.text(titleSelect(meta.recurring ? NOTIF_TITLES.recur : NOTIF_TITLES.once));
        const $title = $('.notification-scheduled-title', $notifBody);

        if (showTitle) {
            $title.text(chatRoom.topic).removeClass('hidden');
        }

        const $prev = $('.notification-scheduled-prev', $notifBody);
        const $new = $('.notification-scheduled-occurrence', $notifBody);

        if (prev && !(meta.occurrence && meta.mode === MODE.CANCELLED)) {
            $prev.removeClass('hidden');
            $('s', $prev).text(prev);
        }
        if (now) {
            $new.removeClass('hidden');
            $new.text(now);
        }
        $notificationHtml.addClass('nt-schedule-meet').attr('data-chatid', chatRoom.chatId);
        return $notificationHtml;
    },

    renderFileRequestUpload($notificationHtml, notification) {
        'use strict';

        const fileHandle = notification.data.h || notification.allDataItems[0].h;
        const fileNode = M.d[fileHandle] || {};
        const folderHandle = fileNode.p || notification.data.n;

        // File has likely been deleted
        if (!folderHandle) {
            return false;
        }
        const folderNode = M.d[folderHandle];
        const folderName = folderNode.name ? notify.shortenNodeName(folderNode.name) : false;

        let title;
        let header;

        const numberOfFiles = notification.allDataItems.length;
        const uploader = notification.userHandle;

        if (uploader) {
            title = mega.icu.format(l.file_request_notification, numberOfFiles)
                .replace('%1', uploader).replace('%2', folderName);
            header = uploader;
        }
        else {
            title = mega.icu.format(l.file_request_notification_nameless, numberOfFiles).replace('%1', folderName);
            header = l.file_request_notification_header;
        }

        const $iconHtml = this.$popup.find('.file-request-notification.template').clone().removeClass('hidden');

        $('.notification-info', $notificationHtml).text(title);
        $notificationHtml.attr('data-folder-id', folderNode.h);
        $notificationHtml.addClass('nt-new-files nt-file-request clickable');
        $('.notification-username', $notificationHtml).text(header);
        $('.notification-avatar', $notificationHtml)
            .removeClass('hidden')
            .safePrepend($iconHtml.prop('outerHTML'));
        $('.notification-icon', $notificationHtml).addClass('hidden');
        $('.notification-avatar-icon', $notificationHtml).addClass('hidden');

        return $notificationHtml;
    },

    // This object handles the countdown timer for dynamic notifications with < 1h remaining.
    // There will likely only ever be one, however it is possible to have
    // any number of active notifications requiring a countdown.
    dynamicNotifCountdown: {

        countDownNotifs: {},
        keys: [],

        addNotifToCounter(id, expiry) {
            'use strict';
            this.countDownNotifs[id] = {
                $expText: undefined,
                expiry,
            };
        },

        removeNotifFromCounter(id) {
            'use strict';
            delete this.countDownNotifs[id];
            this.keys = Object.keys(this.countDownNotifs);
            if (!this.keys.length) {
                this.removeDynamicNotifCountdown();
            }
        },

        disableClick(id) {
            'use strict';
            const $notification = $(`#dynamic-notif-${id}`, notify.$popup).off('click.notifications');
            $('button', $notification).addClass('disabled');
        },

        // Re-check the current items in the countdown timer, and make sure that it is running
        startTimer() {
            'use strict';

            this.keys = Object.keys(this.countDownNotifs);
            if (!this.keys.length) {
                return;
            }

            for (const key of this.keys) {
                this.countDownNotifs[key].$expText = $(`#dynamic-notif-${key} .notification-date`, notify.$popup);
            }

            if (!this.countdown) {
                this.countdown = setInterval(() => {
                    const currentTime = unixtime();
                    for (const key of this.keys) {
                        const remaining = this.countDownNotifs[key].expiry - currentTime;
                        this.countDownNotifs[key].$expText
                            .text(time2offerExpire(remaining, true));
                        if (remaining <= 0) {
                            // Close the notification banner if the one currently shown has expired
                            if (notificationBanner.currentNotification &&
                                notificationBanner.currentNotification.id === parseInt(key)) {
                                // Notify any other tabs a banner has closed
                                mBroadcaster.crossTab.notify('closedBanner', parseInt(key));

                                notificationBanner.updateBanner(true);
                            }

                            this.removeNotifFromCounter(key);
                            this.disableClick(key);
                        }
                    }
                }, 1000);
            }
        },

        removeDynamicNotifCountdown() {
            'use strict';
            if (this.countdown) {
                clearInterval(this.countdown);
                delete this.countdown;
            }
        }
    },

    /**
     * Takes in an object and creates a dynamic notification object based on what the object contains.
     * @param {Object} $notificationHtml jQuery object of the notification template HTML
     * @param {Object} notification The notification object. Must have: title(t), description(d) and id(id)
     * May have: expiry date(e), cta button {link: string, text: string}, image details (img, dsp), flags (sb)
     * @returns {Object|false} The HTML to be rendered for the notification
     */
    renderDynamic($notificationHtml, notification) {
        'use strict';

        const {data} = notification;
        if (!data.t || !data.d || !data.id) {
            return;
        }

        if (data.e) {
            // If the notification is expired, do not show it.
            const remaining = data.e - unixtime();
            if (remaining <= 0) {
                return false;
            }
            else if (remaining <= 3600) {
                notify.dynamicNotifCountdown.addNotifToCounter(data.id, data.e);
            }
            const offerExpiryText = time2offerExpire(data.e);
            $('.notification-date', $notificationHtml)
                .text(offerExpiryText)
                .addClass(remaining <= 3600 ? 'red' : '');
        }

        const ctaButton = data.cta1 || data.cta2;
        if (ctaButton && ctaButton.link) {
            const $ctas = $('.cta-buttons', $notificationHtml)
                .removeClass('hidden')
                .addClass(data.cta1 ? 'positive' : '');
            const $button = $('button', $ctas).toggleClass('positive', !!data.cta1);
            $('span', $button).text(ctaButton.text);
        }
        if (data.dsp && data.img) {
            let failed = 0;
            const retina = (window.devicePixelRatio > 1) ? '@2x' : '';
            const imagePath = staticpath + 'images/mega/psa/' + data.img + '@2x.png';

            $('.dynamic-image', $notificationHtml)
                .attr('src', imagePath)
                .removeClass('hidden')
                .rebind('error', function() {
                    // If it failed once it will likely keep failing, prevent infinite loop
                    if (failed) {
                        $(this).addClass('hidden');
                        return;
                    }
                    $(this).attr('src', data.dsp + data.img + retina + '.png');
                    failed = 1;
                });
        }

        $('.notification-info', $notificationHtml).text(data.d);
        $('.notification-username', $notificationHtml).text(data.t);
        $('.notification-promo', $notificationHtml).removeClass('hidden');
        $notificationHtml.addClass('nt-dynamic-notification');
        $notificationHtml.attr('data-dynamic-id', data.id);
        $notificationHtml.attr('id', 'dynamic-notif-' + data.id);

        return $notificationHtml;
    },

    /**
     * Truncates long file or folder names to 30 characters
     * @param {String} name The file or folder name
     * @returns {String} Returns a string similar to 'reallylongfilename...'
     */
    shortenNodeName: function(name) {

        if (name.length > 30) {
            name = name.substr(0, 30) + '...';
        }

        return htmlentities(name);
    },

    /**
     * Gets a display name for the notification. If available it will use the user or contact's name.
     * If the name is unavailable (e.g. a new contact request) then it will use the email address.
     * @param {String} email The email address e.g. ed@fredom.press
     * @returns {String} Returns the name and email as a string e.g. "Ed Snowden (ed@fredom.press)" or just the email
     */
    getDisplayName: function(email) {

        // Use the email by default
        var displayName = email;

        // Search through contacts for the email address
        if (M && M.u) {
            M.u.forEach(function(contact) {

                var contactEmail = contact.m;
                var contactHandle = contact.u;

                // If the email is found
                if (contactEmail === email) {

                    // If the nickname is available use: Nickname
                    if (M.u[contactHandle].nickname !== '') {
                        displayName = nicknames.getNickname(contactHandle);
                    }
                    else {
                        // Otherwise use: FirstName LastName (Email)
                        displayName = (M.u[contactHandle].firstName + ' ' + M.u[contactHandle].lastName).trim()
                                    + ' (' + email + ')';
                    }

                    // Exit foreach loop
                    return true;
                }
            });
        }

        // Escape and return
        return displayName;
    },

    /**
     * Adds an array of dynamic notifications to the current notifications via the action packet system
     * First await that the initial notifications have loaded, otherwise the notifyFromActionPacket call will be blocked
     */
    async addDynamicNotifications() {
        'use strict';

        // Make Get Notification (gnotif) API request
        const {result} = await api.req({a: 'gnotif'});
        let notifAdded = false;

        if (typeof this.lastSeenDynamic === 'undefined') {
            this.lastSeenDynamic
                = parseInt(await Promise.resolve(mega.attr.get(u_handle, 'lnotif', -2, true)).catch(nop)) | 0;
        }

        for (let i = 0; i < result.length; i++) {
            const givenNotif = result[i];

            if (notify.dynamicNotifs[givenNotif.id]) {
                continue;
            }

            const dynamicNotif = {
                ...givenNotif,
                a: 'dynamic',
                timestamp: givenNotif.e || givenNotif.s,
                seen: givenNotif.id <= this.lastSeenDynamic
            };

            // Decode title, description and CTA button texts
            dynamicNotif.t = from8(b64decode(dynamicNotif.t));
            dynamicNotif.d = from8(b64decode(dynamicNotif.d));
            if (dynamicNotif.cta1) {
                dynamicNotif.cta1.text = from8(b64decode(dynamicNotif.cta1.text));
            }
            if (dynamicNotif.cta2) {
                dynamicNotif.cta2.text = from8(b64decode(dynamicNotif.cta2.text));
            }

            // Store the notification so that its variables can be easily accessed
            notify.dynamicNotifs[dynamicNotif.id] = dynamicNotif;

            notifAdded = true;

            // Once the initial notifications have loaded, add the dynamic notification via the action packet system
            notify.initialLoading
                .then(() => {
                    notify.notifyFromActionPacket(dynamicNotif);

                    // If the notification centre is open immediately after the page is loaded,
                    // send an event to the API if any dynamic notifications can be seen
                    if (!notify.dynamicNotifsSeenEventSent
                            && !notify.$popup.hasClass('loading') &&
                            notify.$popup.closest('.js-dropdown-notification').hasClass('show')) {
                        notify.sendNotifSeenEvent(Object.keys(notify.dynamicNotifs));

                        // Stop the event being sent more than once
                        notify.dynamicNotifsSeenEventSent = true;
                    }
                })
                .catch(dump);
        }

        if (notifAdded) {
            if (notificationBanner.bannerInited) {
                notificationBanner.updateBanner(false);
            }
            else {
                notificationBanner.init();
            }
        }
    },

    /**
     * If the notification centre is open immediately after the page is loaded,
     * send an event to the API if any dynamic notifications can be seen
     * @param {String} list List of dynamic notification ID's to send with the event
     */
    sendNotifSeenEvent(list) {
        'use strict';

        eventlog(500240, String(Array.isArray(list) ? list.map(Number).sort() : (list | 0)));
    },

    /**
     * Check if the 'notifs' user attribute has been updated (e.g. after redeeming a promo notification,
     * which should remove that notification ID from u_attr.notifs), and update the dynamic notifications
     * and banner as appropriate
     */
    checkForNotifUpdates() {
        'use strict';

        if (!notificationBanner.bannerInited) {
            return;
        }

        // Compare notifs user attribute value (list) to cached notifications list
        const cachedNotifList = Object.keys(notify.dynamicNotifs).map(Number);
        const newNotifList = u_attr.notifs;

        if (cachedNotifList.length !== newNotifList.length) {
            if (newNotifList.length > cachedNotifList.length) {
                // If there's a new notification add it
                notify.addDynamicNotifications().catch(dump);
            }
            else {
                // Otherwise delete the missing notification(s) which should never be shown again
                const notifListDiffs = cachedNotifList.filter(elem => !newNotifList.includes(elem));
                for (const id of notifListDiffs) {
                    delete notify.dynamicNotifs[id];
                    notify.notifications.splice(
                        notify.notifications.findIndex(elem => elem.data.id === id), 1
                    );

                    // Update the notification banner if the one currently being shown is no longer valid
                    if (notificationBanner.currentNotification.id === id) {
                        notificationBanner.updateBanner(true);
                    }
                }

                // If the popup is open, re-render the notifications
                if (!notify.$popup.hasClass('hidden')) {
                    notify.renderNotifications();
                }
            }
        }
    }
};

(function(window) {

/**
 * Functions from Underscore.js 1.4.4
 * http://underscorejs.org
 * (c) 2009-2013 Jeremy Ashkenas, DocumentCloud Inc.
 * Underscore may be freely distributed under the MIT license.
 */
var _ = {
    bind: function _Bind(ctx) {
        return (function(){}).bind.apply(ctx, [].slice.call(arguments, 1));
    },
    bindAll: function _bindAll(obj) {
        [].slice.call(arguments, 1).forEach(function(f) {
            obj[f] = _.bind(obj[f], obj);
        });
    },
    each: function _each(obj, iterator, context) {
        obj.forEach(iterator, context);
    },
    filter: function _filter(obj, iterator, context) {
        return [].slice.call(obj).filter(iterator, context);
    },
    first: function _first(array, n, guard) {
        if (array == null) {
            return void 0;
        }
        return (n != null) && !guard ? array.slice(0, n) : array[0];
    },
    has: function _has(obj, prop) {
        return obj.hasOwnProperty(prop);
    },
    isFunction: function _isFunction(func) {
        return typeof func === 'function';
    },
    isRegExp: function _isRegExp(obj) {
        return Object.prototype.toString.call(obj) === '[object RegExp]';
    }
};

/**
 * Avatar Picker
 * https://bitbucket.org/atlassianlabs/avatar-picker/src
 * A combination of the JS source files required for the avatar picker to work.
 * Built with command:
 * cat canvas-cropper.js <(echo) client-file-handler.js <(echo) client-file-reader.js <(echo) drag-drop-file-target.js <(echo) upload-interceptor.js <(echo) image-explorer.js <(echo) image-upload-and-crop.js > avatar-picker.js
 */
window.CanvasCropper = (function(){
    function CanvasCropper(width, height){
        if (!CanvasCropper.isSupported()) {
            throw new Error("This browser doesn't support CanvasCropper.");
        }
        return this.init.apply(this, arguments);
    }

    var supportsCanvas = (function() {
        var canvas = document.createElement('canvas');
        return (typeof canvas.getContext === 'function') && canvas.getContext('2d');
    }());

    CanvasCropper.isSupported = function() {
        return supportsCanvas;
    };

    CanvasCropper.prototype.defaults = {
        outputFormat: 'image/jpeg',
        backgroundFillColor: undefined
    };

    CanvasCropper.prototype.init = function(width, height, opts) {
        this.width = width;
        this.height = height || width; //Allow single param for square crop
        this.options = $.extend({}, this.defaults, opts);
        this.canvas = $('<canvas/>')
            .attr('width', this.width)
            .attr('height', this.height)
            [0];
        return this;
    };

    CanvasCropper.prototype.cropToDataURI = function(image, sourceX, sourceY, cropWidth, cropHeight) {
        return this
                .crop(image, sourceX, sourceY, cropWidth, cropHeight)
                .getDataURI(this.options.outputFormat);
    };

    CanvasCropper.prototype.crop = function(image, sourceX, sourceY, cropWidth, cropHeight) {
        var context = this.canvas.getContext('2d'),
            targetX = 0,
            targetY = 0,
            targetWidth = this.width,
            targetHeight = this.height;

        context.clearRect(targetX, targetY, targetWidth, targetHeight);

        if (this.options.backgroundFillColor) {
            context.fillStyle = this.options.backgroundFillColor;
            context.fillRect(targetX, targetY, targetWidth, targetHeight);
        }

        /*
         *** Negative sourceX or sourceY ***
         context.drawImage can't accept negative values for source co-ordinates,
         but what you probably meant is you want to do something like the below

         |-------------------|
         |                   |
         |   CROP AREA       |
         |                   |
         |        |----------|----------------|
         |        |          |                |
         |        |          |   IMAGE        |
         |        |          |                |
         |-------------------|                |
                  |                           |
                  |                           |
                  |                           |
                  |                           |
                  |---------------------------|

         We need to do a couple of things to make that work.
         1. Set the target position to the proportional location of the source position
         2. Set source co-ordinates to 0
         */

        if (sourceX < 0) {
            targetX = Math.round((Math.abs(sourceX) / cropWidth) * targetWidth);
            sourceX = 0;
        }

        if (sourceY < 0) {
            targetY = Math.round((Math.abs(sourceY) / cropHeight) * targetHeight);
            sourceY = 0;
        }

        /*
         *** source co-ordinate + cropSize > image size ***
         context.drawImage can't accept a source co-ordinate and a crop size where their sum
         is greater than the image size. Again, below is probably what you wanted to achieve.


         |---------------------------|
         |                           |
         |       IMAGE               |
         |                           |
         |                           |
         |               |-----------|-------|
         |               |           |       |
         |               |     X     |       |
         |               |           |       |
         |---------------|-----------|       |
                         |                   |
                         |   CROP AREA       |
                         |                   |
                         |-------------------|

         We need to do a couple of things to make that work also.
         1. Work out the size of the actual image area to be cropped (X).
         2. Get the proportional size of the target based on the above
         3. Set the crop size to the actual crop size.
         */

        if (sourceX + cropWidth > image.naturalWidth) {
            var newCropWidth = image.naturalWidth - sourceX;
            targetWidth *= newCropWidth / cropWidth;
            cropWidth = newCropWidth;
        }

        if (sourceY + cropHeight > image.naturalHeight) {
            var newCropHeight = image.naturalHeight - sourceY;
            targetHeight *= newCropHeight / cropHeight;
            cropHeight = newCropHeight;
        }

        context.drawImage(
            image,
            sourceX,
            sourceY,
            cropWidth,
            cropHeight,
            targetX,
            targetY,
            targetWidth,
            targetHeight
        );

        return this;
    };

    CanvasCropper.prototype.getDataURI = function(outputFormat) {
        if (outputFormat) { //TODO: Check if in array of valid mime types
            return this.canvas.toDataURL(outputFormat, 0.75);
        } else {
            return null;
        }
    };

    return CanvasCropper;
})();

window.ClientFileHandler = (function(){

    function ClientFileHandler(opts){
        return this.init(opts);
    }

    ClientFileHandler.typeFilters = {
        all: /.*/,
        application: /^application\/.*/,
        audio: /^audio\/.*/,
        image: /^image\/.*/,
        imageWeb: /^image\/(jpeg|png|gif)$/,
        text: /^text\/.*/,
        video: /^video\/.*/
    };

    ClientFileHandler.prototype.defaults = {
        fileTypeFilter: ClientFileHandler.typeFilters.all, //specify a regex or use one of the built in typeFilters
        fileCountLimit: Infinity, //How many files can a user upload at once? This will limit it to the first n files,
        fileSizeLimit: 20 * 1024 * 1024, //Maximum file size in bytes (20MB per file),
        onSuccess: $.noop,
        onError: $.noop
    };

    ClientFileHandler.prototype.init = function(opts){
        this.options = $.extend({}, this.defaults, opts);

        if (opts && !opts.fileSizeLimit) {
            this.options.fileSizeLimit = this.defaults.fileSizeLimit;
        }
        if (opts && !opts.fileCountLimit) {
            this.options.fileCountLimit = this.defaults.fileCountLimit;
        }

        _.bindAll(this, 'handleFiles', 'filterFiles');

        return this;
    };

    /**
     * Takes in an array of files, processes them, and fires the onSuccess handler if any are valid, or the onError handler
     * otherwise. These handlers can be specified on the options object passed to the constructor.
     * @param fileList array of objects like { size:Number, type:String }
     * @param fileSourceElem - Unused. Matches IframeUploader interface\
     * @param event - event to check user drop a folder
     */
    ClientFileHandler.prototype.handleFiles = function(fileList, fileSourceElem, event){
        //Assumes any number of files > 0 is a success, else it's an error
        var filteredFiles = this.filterFiles(fileList, event);

        if (filteredFiles.valid.length > 0) {
            //There was at least one valid file
            _.isFunction(this.options.onSuccess) && this.options.onSuccess(filteredFiles.valid);
        } else {
            //there were no valid files added
            _.isFunction(this.options.onError) && this.options.onError(filteredFiles.invalid);
        }
    };

    ClientFileHandler.prototype.filterFiles = function(fileList, event){
        var fileTypeFilter = _.isRegExp(this.options.fileTypeFilter) ? this.options.fileTypeFilter : this.defaults.fileTypeFilter,
            fileSizeLimit = this.options.fileSizeLimit,
            invalid = {
                byType: [],
                bySize: [],
                byCount: []
            },
            valid = _.filter(fileList, function(file){

                if (M.checkFolderDrop(event)) {
                    invalid.byType.push(file);
                    return false;
                }

                if (!fileTypeFilter.test(file.type)) {
                    invalid.byType.push(file);
                    return false;
                }

                if (file.size > fileSizeLimit) {
                    invalid.bySize.push(file);
                    return false;
                }

                return true;
            });

        if (valid.length > this.options.fileCountLimit) {
            invalid.byCount = valid.slice(this.options.fileCountLimit);
            valid = valid.slice(0, this.options.fileCountLimit);
        }

        return {
            valid: valid,
            invalid: invalid
        };
    };

    return ClientFileHandler;

})();

window.ClientFileReader = (function(){

    var fileReaderSupport = !!(window.File && window.FileList && window.FileReader);

    var _readMethodMap = {
        ArrayBuffer : 'readAsArrayBuffer',
        BinaryString: 'readAsBinaryString',
        DataURL : 'readAsDataURL',
        Text : 'readAsText'
    };

    function ClientFileReader(opts){
        if (!ClientFileReader.isSupported()) {
            throw new Error("ClientFileReader requires FileReaderAPI support");
        }
        return this.init(opts);
    }

    ClientFileReader.isSupported = function() {
        return fileReaderSupport;
    };

    $.extend(ClientFileReader.prototype, ClientFileHandler.prototype);



    ClientFileReader.readMethods = {
        ArrayBuffer : 'ArrayBuffer',
        BinaryString: 'BinaryString',
        DataURL : 'DataURL',
        Text : 'Text'
    };

    ClientFileReader.typeFilters = ClientFileHandler.typeFilters; //Expose this to the calling code

    ClientFileReader.prototype.defaults = $.extend({}, ClientFileHandler.prototype.defaults, {
        readMethod: ClientFileReader.readMethods.DataURL,
        onRead: $.noop
    });

    ClientFileReader.prototype.init = function(opts) {
        _.bindAll(this, 'onSuccess', 'readFile');
        ClientFileHandler.prototype.init.call(this, opts);

        this.options.onSuccess = this.onSuccess; //We don't want this to be optional.
        return this;
    };

    ClientFileReader.prototype.onSuccess = function(files) {
        var readMethod = _.has(_readMethodMap, this.options.readMethod) ? _readMethodMap[this.options.readMethod] : undefined;

        if (readMethod) {
            _.each(files, _.bind(function(file){
                var fileReader = new FileReader();
                fileReader.onload = _.bind(this.readFile, this, file); //pass the file handle to allow callback access to filename, size, etc.
                fileReader[readMethod](file);
            }, this));
        }
    };

    ClientFileReader.prototype.readFile = function(file, fileReaderEvent){
        _.isFunction(this.options.onRead) && this.options.onRead(fileReaderEvent.target.result, file);
    };

    return ClientFileReader;
})();

window.DragDropFileTarget = (function(){

    function DragDropFileTarget(el, opts){
        return this.init.apply(this, arguments);
    }

    DragDropFileTarget.prototype.getDefaults = function() {
        return {
            activeDropTargetClass: 'active-drop-target',
            uploadPrompt: 'Drag a file here to upload',
            clientFileHandler: null
        };
    };

    DragDropFileTarget.prototype.init = function(el, opts){
        _.bindAll(this, 'onDragOver', 'onDragEnd', 'onDrop');

        this.$target = $(el);
        this.options = $.extend({}, this.getDefaults(), opts);

        this.$target.attr('data-upload-prompt', this.options.uploadPrompt);

        //bind drag & drop events
        this.$target.on('dragover', this.onDragOver);
        this.$target.on('dragleave', this.onDragEnd);
        this.$target.on('dragend', this.onDragEnd);
        this.$target.on('drop', this.onDrop);
    };

    DragDropFileTarget.prototype.onDragOver = function(e){
        e.preventDefault();
        this.$target.addClass(this.options.activeDropTargetClass);
    };

    DragDropFileTarget.prototype.onDragEnd = function(e){
        e.preventDefault();
        this.$target.removeClass(this.options.activeDropTargetClass);
    };

    DragDropFileTarget.prototype.onDrop = function(e){
        e.preventDefault();
        e.originalEvent.preventDefault();

        this.$target.removeClass(this.options.activeDropTargetClass);

        if (this.options.clientFileHandler) {
            this.options.clientFileHandler.handleFiles(e.originalEvent.dataTransfer.files, e.originalEvent.target, e);
        }
    };

    return DragDropFileTarget;
})();
window.UploadInterceptor = (function(){

    function UploadInterceptor(el, opts){
        return this.init.apply(this, arguments);
    }

    UploadInterceptor.prototype.defaults = {
        replacementEl: undefined,
        clientFileHandler: null
    };

    UploadInterceptor.prototype.init = function(el, opts) {
        _.bindAll(this, 'onSelectFile', 'onReplacementClick');

        this.$el = $(el);
        this.options = $.extend({}, this.defaults, opts);

        this.$el.on('change', this.onSelectFile);

        if (this.options.replacementEl) {
            this.$replacement = $(this.options.replacementEl);
            this.$el.hide();

            // IE marks a file input as compromised if has a click triggered programmatically
            // and this prevents you from later submitting it's form via Javascript.
            // The work around is to use a label as the replacementEl with the `for` set to the file input,
            // but it requires that the click handler below not be bound. So regardless of whether you want
            // to use the workaround or not, the handler should not be bound in IE.
            if ($.browser && $.browser.msie) {
                if (!this.$replacement.is('label')) {
                    // Workaround is not being used, fallback to showing the regular file element and hide the replacement
                    this.$replacement.hide();
                    this.$el.show();
                }
            } else {
                this.$replacement.on('click', this.onReplacementClick);
            }
        }
    };

    UploadInterceptor.prototype.onSelectFile = function(e){
        if ($(e.target).val() && this.options.clientFileHandler) {
            this.options.clientFileHandler.handleFiles(e.target.files, this.$el, e);
        }
    };

    UploadInterceptor.prototype.onReplacementClick = function(e){
        e.preventDefault();
        this.$el.click();
    };

    UploadInterceptor.prototype.destroy = function(){
        this.$el.off('change', this.onSelectFile);
        this.$replacement.off('click', this.onReplacementClick);
    };

    return UploadInterceptor;
})();
window.ImageExplorer = (function(){

    function ImageExplorer($container, opts){
        this.init.apply(this, arguments);
    }

    ImageExplorer.scaleModes = {
        fill: 'fill',
        contain: 'contain',
        containAndFill: 'containAndFill'
    };

    ImageExplorer.zoomModes = {
        localZoom: 'localZoom', //Keep the area under the mask centered so you zoom further in on the same location.
        imageZoom: 'imageZoom' //Keep the image centered in its current location, so unless the image is centered under the mask, the area under the mask will change.
    };

    ImageExplorer.prototype.defaults = {
        initialScaleMode: ImageExplorer.scaleModes.fill,
        zoomMode: ImageExplorer.zoomModes.localZoom,
        emptyClass: 'empty',
        scaleMax: 1 //Maximum image size is 100% (is overridden by whatever the initial scale is calculated to be)
    };

    ImageExplorer.prototype.init = function($container, opts){
        this.$container      = $container;
        this.$imageView      = this.$container.find('.image-explorer-image-view');
        this.$sourceImage    = this.$container.find('.image-explorer-source');
        this.$mask           = this.$container.find('.image-explorer-mask');
        this.$dragDelegate   = this.$container.find('.image-explorer-drag-delegate');
        this.$scaleSlider    = this.$container.find('.zoom-slider');
        this.$zoomOutButton  = this.$container.find('.zoom-out');
        this.$zoomInButton   = this.$container.find('.zoom-in');
        this.options         = $.extend({}, this.defaults, opts);
        this.imageProperties = {};

        _.bindAll(this, 'getImageSrc', 'setImageSrc', 'initImage', 'initDragDelegate', 'initScaleSlider', 'setInitialScale',
            'getFillScale', 'getContainedScale', 'getCircularContainedScale', 'sliderValToScale', 'scaleToSliderVal',
            'updateImageScale', 'resetImagePosition', 'resetScaleSlider', 'toggleEmpty', 'get$ImageView', 'get$SourceImage',
            'get$Mask', 'get$DragDelegate', 'getMaskedImageProperties', 'showError', 'clearError', 'hasValidImage',
            '_resetFromError', '_removeError', 'initZoomSlider');

        this.toggleEmpty(true); //assume the explorer is empty initially and override below if otherwise

        if (this.$sourceImage[0].naturalWidth) {
            //The image has already loaded (most likely because the src was specified in the html),
            //so remove the empty class and call initImage passing through a fake event object with the target
            this.toggleEmpty(false);

            this.initImage({
                target:this.$sourceImage[0]
            });
        }

        this.$sourceImage.on('load', this.initImage);

        this.initScaleSlider();
        this.initDragDelegate();
    };

    ImageExplorer.prototype.getImageSrc = function(){
        return (this.$sourceImage) ? this.$sourceImage.attr('src') : undefined;
    };

    ImageExplorer.prototype.setImageSrc = function(src){
        if (this.$sourceImage) {
            this.$sourceImage.attr('src', '').attr('src', src); //Force image to reset if the user uploads the same image
        }
    };

    ImageExplorer.prototype.initImage = function(e){
        var image = e.target;
        this.imageProperties.naturalWidth = image.naturalWidth;
        this.imageProperties.naturalHeight = image.naturalHeight;

        this._removeError();
        this.toggleEmpty(false);
        this.setInitialScale();
    };

    ImageExplorer.prototype.initDragDelegate = function(){
        var imageOffset;

        this.$dragDelegate.draggable({
            start: _.bind(function(){
                imageOffset = this.$sourceImage.offset();
            }, this),
            drag: _.bind(function(e, ui){
                this.$sourceImage.offset({
                    top: imageOffset.top + ui.position.top - ui.originalPosition.top,
                    left: imageOffset.left + ui.position.left - ui.originalPosition.left
                });
            }, this)
        });
    };

    ImageExplorer.prototype.initZoomSlider = function(value = 0) {
        const container = document.querySelector('.avatar-dialog');
        const wrapper = container && container.querySelector('.zoom-slider-wrap');
        const $elm = $('.zoom-slider', wrapper);
        const setValue = tryCatch(() => {
            wrapper.dataset.perc = value;
            $elm.slider('value', value);
        });

        if (!wrapper) {
            if (d) {
                console.error('zoom-slider-wrap not found.');
            }
            return;
        }

        if (wrapper.dataset.perc) {
            // Update existing slider.
            return setValue();
        }

        // Init zoom slider
        $elm.slider({
            min: 0,
            max: 100,
            range: 'min',
            step: 1,
            change: function(e, ui) {
                $(this).attr('title', `${ui.value}%`);
                wrapper.dataset.perc = ui.value;
            },
            slide: _.bind(function(e, ui) {
                $(this).attr('title', `${ui.value}%`);
                this.updateImageScale(this.sliderValToScale(ui.value));
            },this),
            create: setValue
        });
    }

    ImageExplorer.prototype.initScaleSlider = function() {
        this.initZoomSlider(0);
        this.$zoomOutButton.on('click', _.bind(function() {
            this.$scaleSlider.slider('value', parseInt(this.$scaleSlider.slider('value')) - 10);
            this.updateImageScale(this.sliderValToScale(this.$scaleSlider.slider('value')));
        }, this));
        this.$zoomInButton.on('click', _.bind(function() {
            this.$scaleSlider.slider('value', parseInt(this.$scaleSlider.slider('value')) + 10);
            this.updateImageScale(this.sliderValToScale(this.$scaleSlider.slider('value')));
        }, this));
    };

    ImageExplorer.prototype.setInitialScale = function(){
        var maskWidth = this.$mask.width(),
            maskHeight =this.$mask.height(),
            naturalWidth = this.imageProperties.naturalWidth,
            naturalHeight = this.imageProperties.naturalHeight,
            initialScale = 1;

        this.minScale = 1;

        switch(this.options.initialScaleMode) {
            case ImageExplorer.scaleModes.fill:
                //sets the scale of the image to the smallest size possible that completely fills the mask.
                this.minScale = initialScale = this.getFillScale(naturalWidth, naturalHeight, maskWidth, maskHeight);
            break;

            case ImageExplorer.scaleModes.contain:
                //Sets the scale of the image so that the entire image is visible inside the mask.
                if (this.$mask.hasClass('circle-mask')) {
                    this.minScale = initialScale = this.getCircularContainedScale(naturalWidth, naturalHeight, maskWidth / 2);
                } else {
                    this.minScale = initialScale = this.getContainedScale(naturalWidth, naturalHeight, maskWidth, maskHeight);
                }
            break;

            case ImageExplorer.scaleModes.containAndFill:
                //Set the min scale so that the lower bound is the same as scaleModes.contain, but the initial scale is scaleModes.fill
                if (this.$mask.hasClass('circle-mask')) {
                    this.minScale = this.getCircularContainedScale(naturalWidth, naturalHeight, maskWidth / 2);
                } else {
                    this.minScale = this.getContainedScale(naturalWidth, naturalHeight, maskWidth, maskHeight);
                }

                initialScale = this.getFillScale(naturalWidth, naturalHeight, maskWidth, maskHeight);
            break;
        }

        this.maxScale = Math.max(initialScale, this.options.scaleMax);
        this.resetScaleSlider();
        //Always use ImageExplorer.zoomModes.imageZoom when setting the initial scale to center the image.
        this.updateImageScale(initialScale, ImageExplorer.zoomModes.imageZoom);
        this.resetImagePosition();
    };

    ImageExplorer.prototype.getFillScale = function(imageWidth, imageHeight, constraintWidth, constraintHeight){
        var widthRatio = constraintWidth / imageWidth,
            heightRatio = constraintHeight / imageHeight;
        return Math.max(widthRatio, heightRatio);
    };

    ImageExplorer.prototype.getContainedScale = function(imageWidth, imageHeight, constraintWidth, constraintHeight){
        var widthRatio = constraintWidth / imageWidth,
            heightRatio = constraintHeight / imageHeight;
        return Math.min(widthRatio, heightRatio);
    };

    ImageExplorer.prototype.getCircularContainedScale = function(imageWidth, imageHeight, constraintRadius){
        var theta = Math.atan(imageHeight / imageWidth),
            scaledWidth = Math.cos(theta) * constraintRadius * 2;
            //Math.cos(theta) * constraintRadius gives the width from the centre of the circle to one edge so we need to double it.
        return scaledWidth / imageWidth;
    };

    ImageExplorer.prototype.sliderValToScale = function(sliderValue) {
        var sliderValAsUnitInterval = sliderValue / (this.$scaleSlider.slider('option', 'max') - this.$scaleSlider.slider('option', 'min'));
        //http://math.stackexchange.com/questions/2489/is-there-a-name-for-0-1 (was tempted to use sliderValAsWombatNumber)
        return this.minScale + (sliderValAsUnitInterval * (this.maxScale - this.minScale));
    };

    ImageExplorer.prototype.scaleToSliderVal = function(scale) {
        //Slider represents the range between maxScale and minScale, normalised as a percent (the HTML slider range is 0-100).
        var sliderValAsUnitInterval = (scale - this.minScale) / (this.maxScale - this.minScale);

        return sliderValAsUnitInterval * (this.$scaleSlider.slider('option', 'max') - this.$scaleSlider.slider('option', 'min'));
    };

    ImageExplorer.prototype.updateImageScale = function(newScale, zoomMode){
        var newWidth = Math.round(newScale * this.imageProperties.naturalWidth) + 7,
            newHeight = Math.round(newScale * this.imageProperties.naturalHeight) + 7,
            newMarginLeft,
            newMarginTop;

        zoomMode = zoomMode || this.options.zoomMode;

        switch (zoomMode) {
            case ImageExplorer.zoomModes.imageZoom:
                newMarginLeft = -1 * newWidth / 2;
                newMarginTop = -1 * newHeight / 2;
            break;

            case ImageExplorer.zoomModes.localZoom:
                var oldWidth = this.$sourceImage.width(),
                    oldHeight = this.$sourceImage.height(),
                    oldMarginLeft = parseInt(this.$sourceImage.css('margin-left'), 10),
                    oldMarginTop = parseInt(this.$sourceImage.css('margin-top'), 10),
                    sourceImagePosition = this.$sourceImage.position(), //Position top & left only. Doesn't take into account margins
                    imageViewCenterX = this.$imageView.width() / 2,
                    imageViewCenterY = this.$imageView.height() / 2,
                    //Which pixel is currently in the center of the mask? (assumes the mask is centered in the $imageView)
                    oldImageFocusX = imageViewCenterX - sourceImagePosition.left - oldMarginLeft,
                    oldImageFocusY = imageViewCenterY - sourceImagePosition.top - oldMarginTop,
                    //Where will that pixel be once the image is resized?
                    newImageFocusX = (oldImageFocusX / oldWidth) * newWidth,
                    newImageFocusY = (oldImageFocusY / oldHeight) * newHeight;

                //How many pixels do we need to shift the image to put the new focused pixel in the center of the mask?
                newMarginLeft = imageViewCenterX - sourceImagePosition.left - newImageFocusX;
                newMarginTop = imageViewCenterY - sourceImagePosition.top - newImageFocusY;
            break;
        }

        this.$sourceImage.add(this.$dragDelegate)
            .width(newWidth)
            .height(newHeight)
            .css({
                'margin-left': Math.round(newMarginLeft) +'px',
                'margin-top': Math.round(newMarginTop) +'px'
            });
            var x1 = this.$mask.offset().left + this.$mask.width() - newMarginLeft - newWidth + 4;
            var y1 = this.$mask.offset().top + this.$mask.height() - newMarginTop - newHeight + 4;
            var x2 = this.$mask.offset().left - newMarginLeft - 4;
            var y2 = this.$mask.offset().top - newMarginTop - 4;

        this.$dragDelegate.draggable('option', 'containment', [x1, y1, x2, y2]);
    };


    ImageExplorer.prototype.resetImagePosition = function(){
        this.$sourceImage.add(this.$dragDelegate).css({
            top: '50%',
            left: '50%'
        });
    };

    ImageExplorer.prototype.resetScaleSlider = function(){
        this.$scaleSlider.slider('value', 0)
            .removeClass('disabled')
            .removeAttr('disabled');
    };

    ImageExplorer.prototype.toggleEmpty = function(toggle) {
        this.$container.toggleClass(this.options.emptyClass, toggle);
    };

    ImageExplorer.prototype.get$ImageView = function(){
        return this.$imageView;
    };

    ImageExplorer.prototype.get$SourceImage = function(){
        return this.$sourceImage;
    };

    ImageExplorer.prototype.get$Mask = function(){
        return this.$mask;
    };

    ImageExplorer.prototype.get$DragDelegate = function(){
        return this.$dragDelegate;
    };

    ImageExplorer.prototype.getMaskedImageProperties = function(){
        var currentScaleX = this.$sourceImage.width() / this.imageProperties.naturalWidth,
            currentScaleY = this.$sourceImage.height() / this.imageProperties.naturalHeight,
            maskPosition = this.$mask.position(),
            imagePosition = this.$sourceImage.position();

            maskPosition.top += parseInt(this.$mask.css('margin-top'), 10);
            maskPosition.left += parseInt(this.$mask.css('margin-left'), 10);

            imagePosition.top += parseInt(this.$sourceImage.css('margin-top'), 10);
            imagePosition.left += parseInt(this.$sourceImage.css('margin-left'), 10);

        return {
            maskedAreaImageX : Math.round((maskPosition.left - imagePosition.left) / currentScaleX),
            maskedAreaImageY : Math.round((maskPosition.top - imagePosition.top) / currentScaleY),
            maskedAreaWidth  : Math.round(this.$mask.width() / currentScaleX),
            maskedAreaHeight : Math.round(this.$mask.height() / currentScaleY)
        };
    };

    ImageExplorer.prototype.showError = function(title, contents) {
        this._removeError();
        this.toggleEmpty(true);

        alert(title + ' ' + contents);
    };

    ImageExplorer.prototype.clearError = function() {
        this._removeError();
        this._resetFromError();
    };

    ImageExplorer.prototype.hasValidImage = function(){
        return !!(this.getImageSrc() && this.$sourceImage.prop('naturalWidth'));
    };

    ImageExplorer.prototype._resetFromError = function(){
        // When the error is closed/removed, if there was a valid img in the explorer, show that,
        // otherwise keep displaying the 'empty' view
        // Might also need to do something in the caller (e.g. ImageUploadAndCrop) so fire an optional callback.
        var hasValidImage = this.hasValidImage();
        this.toggleEmpty(!hasValidImage);
        this.$container.removeClass('error');
        _.isFunction(this.options.onErrorReset) && this.options.onErrorReset(hasValidImage ? this.getImageSrc() : undefined);
    };

    ImageExplorer.prototype._removeError = function(){
        this.$imageView.find('.aui-message.error').remove();
    };

    return ImageExplorer;
})();
window.ImageUploadAndCrop = (function(){

    function ImageUploadAndCrop($container, opts){
        if (!ImageUploadAndCrop.isSupported()) {
            throw new Error("This browser doesn't support ImageUploadAndCrop.");
        }
        this.init.apply(this, arguments);
    }

    ImageUploadAndCrop.isSupported = function() {
        return CanvasCropper.isSupported();
    };

    ImageUploadAndCrop.prototype.defaults = {
        HiDPIMultiplier: 2,  //The canvas crop size is multiplied by this to support HiDPI screens
        dragDropUploadPrompt: l[1390],
        onImageUpload: $.noop,
        onImageUploadError: $.noop,
        onCrop: $.noop,
        outputFormat: 'image/png',
        fallbackUploadOptions: {},
        initialScaleMode: ImageExplorer.scaleModes.fill,
        scaleMax: 1,
        fileSizeLimit: 15 * 1024 * 1024, //5MB
        maxImageDimension: 5000 //In pixels
    };

    ImageUploadAndCrop.prototype.init = function($container, opts){
        this.options = $.extend({}, this.defaults, opts);
        this.$container = $container;

        _.bindAll(this, 'crop', 'resetState', '_onFileProcessed', 'setImageSrc', 'validateImageResolution', '_onFilesError',
            '_onFileError', '_resetFileUploadField', '_onErrorReset');

        this.imageExplorer = new ImageExplorer(this.$container.find('.image-explorer-container'), {
            initialScaleMode: this.options.initialScaleMode,
            scaleMax: this.options.scaleMax,
            onErrorReset: this._onErrorReset
        });

        if (ClientFileReader.isSupported()) {
            this.clientFileReader = new ClientFileReader({
                readMethod: 'ArrayBuffer',
                onRead: this._onFileProcessed,
                onError: this._onFilesError,
                fileTypeFilter: ClientFileReader.typeFilters.imageWeb,
                fileCountLimit: 1,
                fileSizeLimit: this.options.fileSizeLimit
            });

            //drag drop uploading is only possible in browsers that support the fileReaderAPI
            this.dragDropFileTarget = new DragDropFileTarget(this.imageExplorer.get$ImageView(), {
                uploadPrompt: this.options.dragDropUploadPrompt,
                clientFileHandler: this.clientFileReader
            });
        } else {
            //Fallback for older browsers. TODO: Client side filetype filtering?

            this.$container.addClass("filereader-unsupported");

            var fallbackOptions = $.extend({
                onUpload: this._onFileProcessed,
                onError: this._onFileError
            }, this.options.fallbackUploadOptions);

            this.clientFileReader = new ClientFileIframeUploader(fallbackOptions);
        }

        this.uploadIntercepter = new UploadInterceptor(this.$container.find('.image-upload-field'), {
            replacementEl: this.$container.find('.image-upload-field-replacement'),
            clientFileHandler: this.clientFileReader
        });

        var mask = this.imageExplorer.get$Mask();

        this.canvasCroppper = new CanvasCropper(
            250,
            250,
            //mask.width() * this.options.HiDPIMultiplier,
            //mask.height() * this.options.HiDPIMultiplier,
            {
                outputFormat: this.options.outputFormat
            }
        );

        this.options.cropButton && $(this.options.cropButton).click(this.crop);
    };

    ImageUploadAndCrop.prototype.crop = function(){
        var cropProperties = this.imageExplorer.getMaskedImageProperties(),
            croppedDataURI = this.canvasCroppper.cropToDataURI(
                this.imageExplorer.get$SourceImage()[0],
                cropProperties.maskedAreaImageX,
                cropProperties.maskedAreaImageY,
                cropProperties.maskedAreaWidth,
                cropProperties.maskedAreaHeight
            );

        _.isFunction(this.options.onCrop) && this.options.onCrop(croppedDataURI);
    };

    ImageUploadAndCrop.prototype.resetState = function(){
        this.imageExplorer.clearError();
        this._resetFileUploadField();
    };

    ImageUploadAndCrop.prototype._onFileProcessed = function(imageData) {
        if (!imageData || !imageData.byteLength) {
            return this._onFileProcessed2(imageData);
        }

        queueMicrotask(async() => {
            this.options.maxImageDimension = NaN;
            this._onFileProcessed2(URL.createObjectURL(await webgl.getIntrinsicImage(imageData, 2160)));
        });
    };

    ImageUploadAndCrop.prototype._onFileProcessed2 = function(imageSrc){
        if (imageSrc){
            if (!isNaN(this.options.maxImageDimension)) {
                var validatePromise = this.validateImageResolution(imageSrc);

                validatePromise
                    .done(_.bind(function(imageWidth, imageHeight){
                        this.setImageSrc(imageSrc);
                    }, this))
                    .fail(_.bind(function(imageWidth, imageHeight){
                        this._onFileError('The selected image size is ' + imageWidth + 'px * ' + imageHeight + 'px. The maximum allowed image size is ' + this.options.maxImageDimension +
                            'px * ' + this.options.maxImageDimension + 'px');
                    }, this));
            } else {
                // If imageResolutionMax isn't valid, skip the validation and just set the image src.
                this.setImageSrc(imageSrc);
            }
        } else {
            this._onFileError();
        }
    };

    ImageUploadAndCrop.prototype.setImageSrc = function(imageSrc) {
        this.imageExplorer.setImageSrc(imageSrc);
        _.isFunction(this.options.onImageUpload) && this.options.onImageUpload(imageSrc);
        this._resetFileUploadField();
    };

    ImageUploadAndCrop.prototype.validateImageResolution = function(imageSrc){
        var validatePromise = $.Deferred(),
            tmpImage = new Image(),
            self = this;

        tmpImage.onload = function(){
            if (this.naturalWidth > self.options.maxImageDimension ||  this.naturalHeight > self.options.maxImageDimension) {
                validatePromise.reject(this.naturalWidth, this.naturalHeight);
            } else {
                validatePromise.resolve(this.naturalWidth, this.naturalHeight);
            }
        };

        tmpImage.src = imageSrc;

        return validatePromise;
    };

    ImageUploadAndCrop.prototype._onFilesError = function(invalidFiles) {
        // Work out the most appropriate error to display. Because drag and drop uploading can accept multiple files and we can't restrict this,
        // it's not an all or nothing situation, we need to try and find the most correct file and base the error on that.
        // If there was at least 1 valid file, then this wouldn't be called, so we don't need to worry about files rejected because of the fileCountLimit

        if (invalidFiles && invalidFiles.bySize && invalidFiles.bySize.length){
            //Some image files of the correct type were filtered because they were too big. Pick the first one to use as an example.
            var file = _.first(invalidFiles.bySize);
            this._onFileError('File "' + str_mtrunc(file.name, 50) + '" is ' + bytesToSize(file.size) +
                ' which is larger than the maximum allowed size of ' + bytesToSize(this.options.fileSizeLimit));
        } else {
            //No files of the correct type were uploaded. The default error message will cover this.
            this._onFileError();
        }
    };

    ImageUploadAndCrop.prototype._onFileError = function(error){
        var title = 'There was an error uploading your image',
            contents = error || 'Please check that your file is a valid image and try again.';

        this.imageExplorer.showError(title, contents);
        this._resetFileUploadField();
        _.isFunction(this.options.onImageUploadError) && this.options.onImageUploadError(error);
    };

    ImageUploadAndCrop.prototype._resetFileUploadField = function(){
        //clear out the fileUpload field so the user could select the same file again to "reset" the imageExplorer
        var form = this.$container.find("#image-upload-and-crop-upload-field").prop('form');
        form && form.reset();
    };

    ImageUploadAndCrop.prototype._onErrorReset = function(imgSrc){
        //If we have a valid image after resetting from the error, notify the calling code.
        if (imgSrc) {
            _.isFunction(this.options.onImageUpload) && this.options.onImageUpload(imgSrc);
        }
    };

    return ImageUploadAndCrop;
})();
})(this);
