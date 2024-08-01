/* Bundle Includes:
 *   js/fm/affiliate.js
 *   js/fm/vpn.js
 *   js/fm/gallery/helpers/GalleryTitleControl.js
 *   js/fm/gallery/helpers/GalleryEmptyBlock.js
 *   js/fm/gallery/helpers/GalleryEmptyPhotos.js
 *   js/fm/gallery/helpers/GalleryEmptyImages.js
 *   js/fm/gallery/helpers/GalleryEmptyVideos.js
 *   js/fm/gallery/helpers/GalleryEmptyFavourites.js
 *   js/fm/gallery/helpers/GalleryEmptyDiscovery.js
 *   js/fm/gallery/gallery.js
 *   js/fm/albums/Albums.js
 *   js/fm/albums/AlbumTimeline.js
 *   js/ui/notificationBanner.js
 */

// Note: Referral Program is called as affiliate program at begining, so all systemic names are under word affiliate
// i.e. affiliate === referral

function affiliateUI() {

    'use strict';

    // Prevent ephemeral session to access
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

    $('.fm-right-files-block, .section.conversations, .fm-right-block.dashboard').addClass('hidden');
    $('.nw-fm-left-icon').removeClass('active');
    $('.nw-fm-left-icon.affiliate').addClass('active').removeClass('animate');

    M.onSectionUIOpen('affiliate');
    loadingDialog.show('affiliateRefresh');

    M.affiliate.getAffiliateData().catch(function() {
        if (d) {
            console.error('Pulling affiliate data failed due to one of it\'s operation failed.');
        }
        msgDialog('warninga', '', l[200] + ' ' + l[253], '', function() {
            loadingDialog.hide('affiliateRefresh');
        });
    }).then(function() {
        onIdle(clickURLs);
        M.affiliate.lastupdate = Date.now();
        loadingDialog.hide('affiliateRefresh');
        affiliateUI.startRender();
    });

    affiliateUI.$body = $('.fm-affiliate.body');

    $('.breadcrumbs .item.active', affiliateUI.$body).rebind('click.breadcrumbs', function() {
        loadSubPage('/fm/dashboard');
    });

    // Init Referral content scrolling
    var $scrollBlock = $('.scroll-block', affiliateUI.$body);

    if ($scrollBlock.is('.ps')) {
        Ps.update($scrollBlock[0]);
    }
    else {
        Ps.initialize($scrollBlock[0]);
    }
}

/*
 * Dialogs start
 */

/**
 * Affiliate guide dialog
 */
affiliateUI.guideDialog = {

    // Init event on affiliate dashboard to open dialog.
    init: function() {

        'use strict';

        var self = this;

        $('.guide-dialog', affiliateUI.$body).rebind('click.guide-dialog', function() {
            affiliateUI.guideDialog.show();

            if (this.classList.contains('to-rules')) {
                onIdle(function() {
                    self.$firstStepBlock.removeClass('active');
                    self.$secondStepBlock.addClass('active');
                    self.showAffiliateSlide(3);
                });
            }
        });
    },

    // Show dialog
    show: function() {

        'use strict';

        var self = this;

        this.$dialog = $('.mega-dialog.affiliate-guide');
        this.$firstStepBlock = $('.step1', this.$dialog);
        this.$secondStepBlock = $('.step2', this.$dialog);
        this.slidesLength = $('.affiliate-guide-content', this.$secondStepBlock).length;

        this.bindDialogEvents();

        // Reset dialog contents
        this.$firstStepBlock.addClass('active');
        this.$secondStepBlock.removeClass('active');
        this.showAffiliateSlide();

        M.safeShowDialog('affiliate-guide-dialog', self.$dialog);
    },

    // Dialog event binding
    bindDialogEvents: function() {

        'use strict';

        var self = this;

        // Step1. Welcome dialog, How it works button click - > show step 2.
        $('button.how-it-works', this.$dialog).rebind('click.guide-dialog-hiw-btn', function() {
            self.$firstStepBlock.removeClass('active');
            self.$secondStepBlock.addClass('active');
        });

        // Step 2. Back/Next buttons
        $('.bottom-button', this.$dialog).rebind('click.btns', function() {
            var currentSlide = $('.nav-button.active', self.$dialog).data('slide');

            if ($(this).hasClass('next') && currentSlide + 1 <= self.slidesLength) {
                self.showAffiliateSlide(currentSlide + 1);
            }
            else if ($(this).hasClass('back') && currentSlide - 1 >=  0) {
                self.showAffiliateSlide(currentSlide - 1);
            }
        });

        $('button.dashboard', this.$secondStepBlock).rebind('click.to-aff-page', function() {
            loadSubPage('fm/refer');
        });

        // Step 2.Top nav buttons
        $('.nav-button', this.$dialog).rebind('click.top-nav', function() {
            self.showAffiliateSlide($(this).attr('data-slide'));
        });

        // Closing dialog related
        $('button.js-close', this.$dialog).rebind('click.close-dialog', function() {
            closeDialog();
            $('.fm-dialog-overlay').off('click.affGuideDialog');
        });

        $('.fm-dialog-overlay').rebind('click.affGuideDialog', function() {
            $('.fm-dialog-overlay').off('click.affGuideDialog');
        });
    },

    // Step 2. Show Slides.
    showAffiliateSlide: function(num) {

        'use strict';

        num = num | 0 || 1;

        $('.affiliate-guide-content.active', this.$secondStepBlock).removeClass('active');
        $('.affiliate-guide-content.slide' + num, this.$secondStepBlock).addClass('active');

        // Show/hide Back button
        if (num === 1) {
            $('.bottom-button.back', this.$secondStepBlock).addClass('hidden');
        }
        else {
            $('.bottom-button.back', this.$secondStepBlock).removeClass('hidden');
        }

        // Slide 3 requires scrollpane
        if (num === 3) {
            var $scrollBlock = $('.affiliate-guide-content.slide3', this.$secondStepBlock);

            if ($scrollBlock.is('.ps')) {
                Ps.update($scrollBlock[0]);
            }
            else {
                Ps.initialize($scrollBlock[0]);
            }

            $('footer', this.$dialog).addClass('has-divider');
        }
        else {
            $('footer', this.$dialog).removeClass('has-divider');
        }

        // Show/hide Affiliate Dashboard button/Next button
        if (num === this.slidesLength) {
            $('.bottom-button.next', this.$secondStepBlock).addClass('hidden');

            if (page === 'fm/refer') {
                $('button.dashboard', this.$secondStepBlock).addClass('hidden');
            }
            else {
                $('button.dashboard', this.$secondStepBlock).removeClass('hidden');
            }
        }
        else {
            $('.mega-button.positive', this.$secondStepBlock).addClass('hidden');
            $('.bottom-button.next', this.$secondStepBlock).removeClass('hidden');
        }

        // Change top buttons state
        $('.nav-button.active', this.$secondStepBlock).removeClass('active');
        $('.nav-button.slide' + num, this.$secondStepBlock).addClass('active');
    }
};

/**
 * Affiliate referral url generation dialog
 */
affiliateUI.referralUrlDialog = {

    // Show dialog
    show: function() {

        'use strict';

        var self = this;
        this.$dialog = $('.mega-dialog.generate-url');

        this.bindDialogEvents();
        $('.page-names span[data-page="start"]', this.$dialog).click();

        var showWelcome = !M.affiliate.id;

        this.updateURL().then(function() {

            M.safeShowDialog('referral-url-dialog', self.$dialog);

            if (showWelcome) {
                affiliateUI.registeredDialog.show(1);
            }
        });
    },

    // Bind dialog dom event
    bindDialogEvents: function() {

        'use strict';

        var self = this;
        var $urlBlock = $('.url', this.$dialog);

        $urlBlock.rebind('click.select', function() {
            var sel, range;
            var el = $(this)[0];
            if (window.getSelection && document.createRange) {
                sel = window.getSelection();
                if (sel.toString() === ''){
                    window.setTimeout(function(){
                        range = document.createRange();
                        range.selectNodeContents(el);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    },1);
                }
            }
        });

        var $copyBtn = $('.copy-button', this.$dialog);

        if (is_extension || M.execCommandUsable()) {
            $copyBtn.removeClass('hidden');
            $copyBtn.rebind('click.copy-to-clipboard', function() {
                if (!$copyBtn.hasClass('disabled')){
                    const links = $.trim($urlBlock.text());
                    const toastTxt = l[7654];
                    copyToClipboard(links, toastTxt);
                }
            });
        }
        else {
            $copyBtn.addClass('hidden');
        }

        var $pageBtns = $('.page-names span', this.$dialog);

        $pageBtns.rebind('click.select-target-page', function() {

            var $this = $(this);

            $pageBtns.removeClass('active');
            $this.addClass('active');

            if ($this.data('page') === 'more') {
                self.updateURL(1);
                $('.custom-block', self.$dialog).removeClass('hidden');
            }
            else {
                self.updateURL();
                $('.custom-block', self.$dialog).addClass('hidden');
            }
        });

        $('.url-input', this.$dialog).rebind('keyup.enter-custom-url', function(e) {
            if (e.keyCode === 13) {
                self.checkAndSetCustomURL();
            }
        });

        $('.custom-button', this.$dialog).rebind('click.enter-custom-url', function() {
            self.checkAndSetCustomURL();
        });

        $('button.js-close', this.$dialog).rebind('click.close-dialog', function() {
            closeDialog();
        });
    },

    /**
     * Check manually entered url by user is valid to generate custom url.
     * If url is not valid (non mega url, etc) show error.
     * @returns {Boolean|undefined} False if value is empty, or undefined as it act as void function
     */
    checkAndSetCustomURL: function() {

        'use strict';

        var val = $('.url-input', this.$dialog).val();
        var baseUrl = 'https://mega.io';
        var baseUrlRegExp = new RegExp(baseUrl, 'ig');

        if (!val) {
            return false;
        }
        else if (val.search(baseUrlRegExp) === 0) {
            this.customTargetPage = val.replace(baseUrlRegExp, '');
            this.updateURL();
        }
        else if (('https://' + val).search(baseUrlRegExp) === 0) {
            this.customTargetPage = val.replace(baseUrl.replace('https://', ''), '');
            this.updateURL();
        }
        else {
            $('.custom-block', this.$dialog).addClass('error');
        }
    },

    /**
     * Update dom input element with url generated from checkAndSetCustomURL function
     * @param {Boolean} clear Clear the input field
     * @returns {Promise} Promise that resolve once process is done.
     */
    updateURL: function(clear) {

        'use strict';

        var targetPage = $('.page-names .active', this.$dialog).data('page');
        var $urlBlock = $('.url', this.$dialog);
        const $copyBtn = $('.copy-button', this.$dialog);

        $('.custom-block', this.$dialog).removeClass('error');

        if (clear) {
            $urlBlock.empty();
            $('.url-input', this.$dialog).val('');
            $copyBtn.addClass('disabled');
            return Promise.resolve();
        }
        $copyBtn.removeClass('disabled');

        if (targetPage === 'start') {
            targetPage = '';
        }
        else if (targetPage === 'more' && this.customTargetPage !== undefined) {
            targetPage = this.customTargetPage;

            if (targetPage.charAt(0) === '/') {
                targetPage = targetPage.slice(1);
            }
            if (targetPage.charAt(targetPage.length - 1) === '/') {
                targetPage = targetPage.slice(0, -1);
            }
        }

        return M.affiliate.getURL(targetPage).then(function(url) {
            const urlWithoutAfftag = targetPage === 'help' ? l.mega_help_host
                : `https://mega.io/${targetPage}`;
            $urlBlock.safeHTML(url.replace(urlWithoutAfftag, '<span>' + urlWithoutAfftag + '</span>'));
        });
    },
};

/**
 * Affiliate welcome(registered) dialog
 */
affiliateUI.registeredDialog = {

    // Show dialog
    show: function(skipReq) {

        'use strict';

        if (u_type > 2 && mega.flags.refpr && !pfid) {

            var self = this;
            this.$dialog = $('.mega-dialog.joined-to-affiliate');

            var _showRegisteredDialog = function() {
                self.bindDialogEvents();
                M.safeShowDialog('joined-to-affiliate', self.$dialog);
            };

            if (M.currentdirid === 'refer') {
                $('.how-it-works span', this.$dialog).text(l[81]);
                $('.cancel-button', this.$dialog).addClass('hidden');
            }

            // After referal url dialog.
            if (skipReq) {
                _showRegisteredDialog();
            }
            // User never see this dialog before.
            else if (!M.affiliate.id) {
                M.affiliate.getID().then(function() {
                    _showRegisteredDialog();
                });
            }
        }
    },

    // Bind dialog dom event
    bindDialogEvents: function() {

        'use strict';

        $('.how-it-works', this.$dialog).rebind('click.to-aff-page', function() {
            closeDialog();
            affiliateUI.guideDialog.show();
        });

        $('button.js-close, .cancel-button', this.$dialog).rebind('click.close-dialog', function() {
            closeDialog();
        });
    }
};

/*
 * Dialogs End
 */

/*
 * Dashboard Start
 */

/*
 * Start affiliate dashboard rendering. Required Chart.js
 */
affiliateUI.startRender = function() {

    'use strict';

    loadingDialog.show('affiliateUI');

    affiliateUI.referUsers.init();
    affiliateUI.commissionIndex.init();
    affiliateUI.redemptionHistory.init();
    affiliateUI.geographicDistribution.init();
    affiliateUI.guideDialog.init();

    M.require('charts_js', 'charthelper_js').done(function() {

        affiliateUI.registrationIndex.init();
        affiliateUI.purchaseIndex.init();
        loadingDialog.hide('affiliateUI');
    });
};

/*
 * Refer users section
 */
affiliateUI.referUsers = {

    init: function() {

        'use strict';

        this.bindEvents();
    },

    bindEvents: function() {

        'use strict';

        $('.refer-block', affiliateUI.$body).rebind('click.affRefClick', function() {
            affiliateUI.referUsers.handleClick($(this).data('reftype'));
        });

        $('.refer-users', affiliateUI.$body).rebind('click.affRefClick', function() {
            $('.scroll-block', affiliateUI.$body).animate({scrollTop: 0}, 500);
        });
    },

    /*
     * Click event handling for refer user feature.
     * also used for product page.
     * @param {String} reftype Button clicked by user.
     */
    handleClick: function(reftype) {

        'use strict';

        switch (reftype) {

            case 'url':
                // show URL dialog
                affiliateUI.referralUrlDialog.show();
                break;

            case 'link':
                M.safeShowDialog('create-new-link', function() {
                    M.initFileAndFolderSelectDialog('create-new-link');
                });
                break;

            case 'chatlink':
                M.safeShowDialog('create-new-chat-link', function() {
                    M.initNewChatlinkDialog();
                });
                break;

            case 'invite':
                $.hideContextMenu();
                if (M.isInvalidUserStatus()) {
                    return;
                }
                contactAddDialog(false, true);
                setContactLink();
                break;
        }
    }
};

/*
 * Commission index section
 */
affiliateUI.commissionIndex = {

    init: function() {

        'use strict';

        this.$block = $('.mega-data-box.commission', affiliateUI.$body);

        this.calculateCommission();
        this.bindEvents();
    },

    calculateCommission: function() {

        'use strict';

        var balance = M.affiliate.balance;
        var currencyHtml = '';
        var localTotal;
        var localPending;
        var localAvailable;

        if (balance.localCurrency === 'EUR') {
            $('.non-euro-only', this.$block).addClass('hidden');
            $('.euro-price', this.$block).addClass('hidden');

            localTotal = formatCurrency(balance.localTotal);
            localPending = formatCurrency(balance.localPending);
            localAvailable = formatCurrency(balance.localAvailable);
        }
        else {

            localTotal = formatCurrency(balance.localTotal, balance.localCurrency, 'number');
            localPending = formatCurrency(balance.localPending, balance.localCurrency, 'number');
            localAvailable = formatCurrency(balance.localAvailable, balance.localCurrency, 'number');

            currencyHtml = ' <span class="currency">' + balance.localCurrency + '</span>';

            $('.commission-block.total .euro-price', this.$block)
                .text(formatCurrency(balance.pending + balance.available));
            $('.commission-block.pending .euro-price', this.$block).text(formatCurrency(balance.pending));
            $('.commission-block.available .euro-price', this.$block).text(formatCurrency(balance.available));
        }

        $('.commission-block.total .price', this.$block).safeHTML(localTotal + currencyHtml);
        $('.commission-block.pending .price', this.$block).safeHTML(localPending + currencyHtml);

        currencyHtml += balance.localCurrency === 'EUR' ? '' : '<sup>3</sup>';

        $('.commission-block.available .price', this.$block).safeHTML(localAvailable + currencyHtml);

        if (u_attr.b || u_attr.pf) {
            $('.no-buisness', this.$block).addClass('hidden');
        }

        // Redeem requires at least one payment history and available balance more than 50 euro
        if (M.affiliate.redeemable && balance.available >= 50 && M.affiliate.utpCount) {
            $('button.redeem', this.$block).removeClass('disabled');
        }
        else {
            $('button.redeem', this.$block).addClass('disabled');
        }
    },

    bindEvents: function() {

        'use strict';

        $('button.redeem' ,this.$block).rebind('click.openRedemptionDialog', function() {

            if ($(this).hasClass('disabled')) {
                return false;
            }

            affiliateUI.redemptionDialog.show();
        });
    }
};

affiliateUI.redemptionDialog = {

    show: function() {

        'use strict';

        var self = this;
        var balance = M.affiliate.balance;
        this.rdm = M.affiliate.redemption;
        this.$dialog = $('.mega-dialog.affiliate-redeem');

        // Reset dialog and info
        this.reset();

        M.affiliate.getRedemptionMethods().then(function() {

            self.displaySteps();

            const euro = formatCurrency(balance.available);

            const $availableComissionTemplates = $('.templates .available-comission-template', self.$dialog);
            const $euroTemplate = $('.available-commission-euro', $availableComissionTemplates)
                .clone()
                .removeClass('hidden');
            const $localTemplate = $('.available-commission-local', $availableComissionTemplates)
                .clone()
                .removeClass('hidden');
            const $availableComissionArea = $('.available-comission-quota span', self.$dialog).empty();
            const $availableBitcoinArea = $('.available-comission-bitcoin span', self.$dialog).empty();

            $euroTemplate.text(euro);

            if (balance.localCurrency && balance.localCurrency !== 'EUR') {
                const local = balance.localCurrency + ' ' +
                    formatCurrency(balance.localAvailable, balance.localCurrency, 'narrowSymbol') + '* ';
                $localTemplate.text(local);
                $availableComissionArea
                    .safeAppend($localTemplate.prop('outerHTML'))
                    .safeAppend($euroTemplate.prop('outerHTML'));
            }
            else {
                $('.affiliate-redeem.local-info span', self.$dialog).addClass('hidden');
                $localTemplate.text(euro + '*');
                $availableComissionArea.safeAppend($localTemplate.prop('outerHTML'));
            }

            $availableBitcoinArea.safeAppend($localTemplate.text(euro).prop('outerHTML'));




            self.bindDialogEvents();

            M.safeShowDialog('affiliate-redeem-dialog', self.$dialog);

        }).catch(function(ex) {

            if (d) {
                console.error('Requesting redeem method list failed: ', ex);
            }

            msgDialog('warninga', '', l[200] + ' ' + l[253]);
        });
    },

    showSubmitted: function() {

        'use strict';

        var __closeSubmitted = function() {

            closeDialog();
            $('.fm-dialog-overlay').off('click.redemptionSubmittedClose');

            // After closing the dialog, refresh balance and history
            Promise.all([M.affiliate.getBalance(), M.affiliate.getRedemptionHistory()]).then(() => {

                affiliateUI.commissionIndex.init();
                affiliateUI.redemptionHistory.updateList();
                affiliateUI.redemptionHistory.drawTable();
                affiliateUI.redemptionHistory.bindEvents();
            }).catch((ex) => {

                if (d) {
                    console.error('Update redmeption page failed: ', ex);
                }

                msgDialog('warninga', '', l[200] + ' ' + l[253]);
            });
        };

        let $dialog;

        if (affiliateRedemption.requests.first.m === 0) {
            $dialog = $('.mega-dialog.affiliate-request-quota', self.$dialog);
            const {m, s, t} = this.getFormattedPlanData(true);

            $('.plan-name', $dialog)
                .text(l.redemption_confirmation_pro_plan_name.replace('%1', affiliateRedemption.plan.planName));
            $('.plan-storage', $dialog).text(l.redemption_confirmation_pro_storage.replace('%1', s));
            $('.plan-quota', $dialog).text(l.redemption_confirmation_pro_transfer.replace('%1', t));
            $('.plan-duration', $dialog).text(l.redemption_confirmation_pro_duration.replace('%1', m));
            $('.affiliate-redeem .summary-wrap .pro-price .plan-info', $dialog).addClass('hidden');
            $('affiliate-redeem .summary-wrap .pro-price .euro', this.$dialog).addClass('hidden');
        }
        else {
            $dialog = $('.mega-dialog.affiliate-request.bitcoin', self.$dialog);
            const message = affiliateRedemption.requests.first.m === 2 ? l[23364] : l[23365];

            $('.status-message', $dialog).text(message);

        }
        // Bind OK and close buttons
        $('button', $dialog).rebind('click', __closeSubmitted);
        $('.fm-dialog-overlay').rebind('click.redemptionSubmittedClose', __closeSubmitted);

        M.safeShowDialog('affiliate-redeem-submitted', $dialog);
    },

    hide: function(noConfirm) {

        'use strict';

        var self = this;
        var __hideAction = function() {

            self.reset();
            closeDialog();
            $('.fm-dialog-overlay').off('click.redemptionClose');
        };

        // if it is not step 1, show confimation dialog before close
        if (noConfirm) {
            __hideAction();
        }
        else {
            msgDialog('confirmation', '', l[20474], l[18229], function(e) {

                if (e) {
                    __hideAction();
                }
            });
        }
    },

    reset: function() {

        'use strict';

        // Reset previous entered data
        $('input:not([type="radio"])', this.$dialog).val('');
        $('#affiliate-payment-type2', this.$dialog).trigger('click');
        $('.next-btn', this.$dialog).addClass('disabled');
        $('#affi-bitcoin-address', this.$dialog).val('');
        // $('#affiliate-redemption-amount', this.$dialog).attr('data-currencyValue', M.affiliate.balance.available);
        $('.checkdiv.checkboxOn', this.$dialog).removeClass('checkboxOn').addClass('checkboxOff');
        $('.save-data-tip', this.$dialog).addClass('hidden');
        $('.dropdown-item-save', this.$dialog).addClass('hidden');

        // Reset options for pro plan redemption
        affiliateRedemption.plan = {
            chosenPlan: pro.filter.affMin[pro.UTQA_RES_INDEX_ACCOUNTLEVEL],
            planName: '',
            planStorage: -1,
            planQuota: -1,
            planDuration: undefined,
            planPriceRedeem: -1,
        };

        affiliateRedemption.reset();
    },

    bindDialogEvents: function() {

        'use strict';

        var self = this;
        var balance = M.affiliate.balance;

        // Naviagtion & close buttons
        var $nextbtn = $('.next-btn', this.$dialog);

        $nextbtn.rebind('click', function() {

            if ($(this).hasClass('disabled')) {
                return false;
            }

            loadingDialog.show('redeemRequest');
            self.$dialog.addClass('arrange-to-back');

            affiliateRedemption.processSteps().then(function(res) {

                if (!res) {
                    return false;
                }

                loadingDialog.hide('redeemRequest');
                self.$dialog.removeClass('arrange-to-back');
                affiliateRedemption.currentStep++;

                // This is end of flow lets close the dialog and show submitted dialog
                if (affiliateRedemption.currentStep === 5) {
                    self.showSubmitted();
                    self.hide(true);
                }
                else {
                    self.displaySteps();
                }

                // For Bitcoin payment skip step 3 after update summary table
                if (affiliateRedemption.currentStep === 3 && affiliateRedemption.requests.first.m === 2) {
                    affiliateRedemption.currentStep++;
                    self.displaySteps();
                }

                // For MEGAquota redemption skip to step 4
                if ([2, 3].includes(affiliateRedemption.currentStep) && affiliateRedemption.requests.first.m === 0){
                    affiliateRedemption.currentStep += (4 - affiliateRedemption.currentStep);  // skip to step 4
                    self.displaySteps();
                }
            });
        });

        $('.prev-btn', this.$dialog).rebind('click', function() {

            affiliateRedemption.currentStep--;

            // For Bitcoin payment skip step 3
            if (affiliateRedemption.currentStep === 3 && affiliateRedemption.requests.first.m === 2) {
                affiliateRedemption.currentStep--;
            }
            else if ([2, 3, 4].includes(affiliateRedemption.currentStep) && affiliateRedemption.requests.first.m === 0){
                affiliateRedemption.currentStep = 1;
            }
            self.displaySteps();

            // If this arrive step 2 again, clear country, currency, and dynamic inputs
            if (affiliateRedemption.currentStep === 2) {
                delete affiliateRedemption.requests.first.c;
                delete affiliateRedemption.requests.first.cc;
                affiliateRedemption.dynamicInputs = {};
                affiliateRedemption.requests.second = {};

                // uncheck all checkbox from step 3.
                $('.step3 .checkdiv.checkboxOn', this.$dialog).removeClass('checkboxOn').addClass('checkboxOff');
            }

            if (affiliateRedemption.currentStep === 1) {

                $('#affi-bitcoin-address', this.$dialog).val('');
                const $checkbox = $('.step2 .checkdiv.checkboxOn', this.$dialog)
                    .removeClass('checkboxOn').addClass('checkboxOff');
                $('input[type="checkbox"]' ,$checkbox).prop('checked', false);
                $('.save-data-tip', this.$dialog).addClass('hidden');
            }
        });

        $('button.js-close', this.$dialog).rebind('click', this.hide.bind(this, false));
        $('.fm-dialog-overlay').rebind('click.redemptionClose', this.hide.bind(this, false));

        // Step 0
        const $step0 = $('.cells.step0', this.$dialog);

        const $template = $('.affiliate-payment-template', $step0);
        const $wrapper = $('.affiliate-redeem .payment-type-wrapper', $step0);
        $wrapper.empty();

        // Generate redemption options based on given gateways
        let tickFirstRadio = true;
        const radioText = {0: l.redemption_method_pro_plan, 2: l[6802]};
        for (const type in M.affiliate.redeemGateways) {
            const $clone = $template.clone();
            $clone.children('.radioOff').children().attr('id', 'affiliate-payment-type' + type).val(type);
            $clone.children('label').attr('for', 'affiliate-payment-type' + type).text(radioText[type]);
            $clone.removeClass('hidden affiliate-payment-template');

            // Make sure first radio option is ticked (Pro plan redemption if it is in gateways)
            if (tickFirstRadio) {
                $clone.children('.radioOff').removeClass('radioOff').addClass('radioOn');
                tickFirstRadio = false;
            }
            $wrapper.safeAppend($clone.prop('outerHTML'));
        }

        $('.payment-type input', $step0).rebind('change.selectMethodType', function() {
            $('.radioOn', $step0).removeClass('radioOn').addClass('radioOff');
            $(this).parent().addClass('radioOn').removeClass('radioOff');
            $nextbtn.removeClass('disabled');
        });

        // Step 1
        var $step1 = $('.cells.step1', this.$dialog);

        const $amount = $('#affiliate-redemption-amount', $step1);
        $amount.trigger('input').trigger('blur');


        $('.withdraw-txt a', $step1).rebind('click.changeMethod', () => {
            affiliateRedemption.currentStep = 0;
            self.displaySteps();
            return false;
        });

        $amount.rebind('input', function() {
            var activeMethodMin = M.affiliate.redeemGateways[$('.payment-type .radioOn input', $step0).val()].min || 50;
            const megaInput = $(this).data('MegaInputs');
            if (megaInput) {
                megaInput.hideError();
            }
            const val = megaInput ? megaInput.getValue() : 0;

            if (val >= activeMethodMin && val <= balance.available) {
                $nextbtn.removeClass('disabled');
            }
            else if (affiliateRedemption.currentStep > 0) {
                $nextbtn.addClass('disabled');
            }
        });

        $amount.rebind('blur', function() {

            var $this = $(this);
            var activeMethodMin = M.affiliate.redeemGateways[$('.payment-type .radioOn input', $step0).val()].min || 50;

            const megaInput = $(this).data('MegaInputs');
            const val = megaInput ? megaInput.getValue() : 0;
            if (!val) {
                $('.info.price.requested .local', this.$dialog).text('------');
            }
            else if (val < activeMethodMin) {
                $this.data('MegaInputs').showError(l[23319].replace('%1', formatCurrency(activeMethodMin)));
            }
            else if (val > balance.available) {
                $this.data('MegaInputs').showError(l[23320]);
            }
            else {
                $('.info.price.requested .local', this.$dialog).text(formatCurrency(val));
                this.value = $this.attr('type') === 'text'
                    ? formatCurrency(val, 'EUR', 'number')
                    : parseFloat(val).toFixed(2);
            }
        });

        $('.redeem-all-btn', $step1).rebind('click.redeemAll', function() {
            $amount.val(balance.available).trigger('input').trigger('blur');
        });


        // Step 2
        var $step2 = $('.cells.step2', this.$dialog);
        const $saveDataTipBitcoin = $('.save-data-tip', $step2);

        $('.withdraw-txt a', $step2).rebind('click.changeMethod', function() {

            affiliateRedemption.currentStep = 0;
            self.displaySteps();

            return false;
        });

        uiCheckboxes($('.save-bitcoin-checkbox', $step2));

        uiCheckboxes($('.bitcoin-fill-checkbox', $step2), value => {

            $('#affi-bitcoin-address', $step2).data('MegaInputs')
                .setValue(value ? M.affiliate.redeemAccDefaultInfo.an : '');
            $saveDataTipBitcoin.addClass('hidden');
        });

        $('#affi-bitcoin-address', $step2).rebind('input.changeBitcoinAddress', function() {

            if (!this.value) {
                $saveDataTipBitcoin.addClass('hidden');
            }
            else if (M.affiliate.redeemAccDefaultInfo && M.affiliate.redeemAccDefaultInfo.an &&
                M.affiliate.redeemAccDefaultInfo.an !== this.value) {

                $saveDataTipBitcoin.removeClass('hidden');
            }

            Ps.update($step2.children('.ps').get(0));
        });

        // Step 3
        var $step3 = $('.cells.step3', this.$dialog);
        var $autofillCheckbox = $('.auto-fill-checkbox', $step3);
        var $saveDataTip = $('.save-data-tip', $step3);

        var __fillupForm = function(empty) {

            var keys = Object.keys(M.affiliate.redeemAccDefaultInfo);

            // Lets do autofill for type first due to it need to render rest of dynamic inputs
            var $type = $('#account-type', $step3);
            var savedValue;
            var $activeOption;

            if ($type.length) {

                // If this has multiple types of dynamic input just reset type, clear dynamic inputs box will be enough
                if (empty) {

                    // Account name
                    var $an = $('#affi-account-name', $step3);
                    $an.data('MegaInputs').setValue('', true);

                    // Account type
                    $('span', $type).text(l[23366]);
                    $('.option.active', $type).removeClass('active');
                    $('.affi-dynamic-acc-info', $step3).empty();

                    return;
                }

                savedValue = M.affiliate.redeemAccDefaultInfo.type;
                $activeOption = $('.option.' + savedValue, $type);
                $type.trigger('click');
                $activeOption.trigger('click');
            }

            for (var i = 0; i < keys.length; i++) {

                var key = keys[i];

                // ccc and type are not need to be processed
                if (key === 'ccc' || key === 'type') {
                    continue;
                }

                var hashedKey = MurmurHash3(key);
                var $target = $('#m' + hashedKey, $step3);

                if (key === 'an') {
                    $target = $('#affi-account-name', $step3);
                }

                savedValue = empty ? '' : M.affiliate.redeemAccDefaultInfo[key];

                if ($target.is('.megaInputs.underlinedText')) {
                    $target.data('MegaInputs').setValue(savedValue, true);
                }
                else if ($target.hasClass('dropdown-input')) {

                    $activeOption = empty ? $('.option:first', $target) :
                        $('.option[data-type="' + savedValue + '"]', $target);

                    $target.trigger('click');
                    $activeOption.trigger('click');
                }
            }
        };

        uiCheckboxes($autofillCheckbox, function(value) {

            const scrollContainer = $step3[0].querySelector('.cell-content');
            __fillupForm(!value);
            $saveDataTip.addClass('hidden');
            Ps.update(scrollContainer);
            scrollContainer.scrollTop = 0;
            $('input', $step3).off('focus.jsp');
        });

        uiCheckboxes($('.save-data-checkbox', $step3));

        $saveDataTip.add($saveDataTipBitcoin).rebind('click.updateAccData', function(e) {

            var $this = $(this);
            var $target = $(e.target);
            var __hideSaveDataTip = function() {

                $this.addClass('hidden');
                const scrollContainer = $this.closest('.cell-content').get(0);
                Ps.update(scrollContainer);
                scrollContainer.scrollTop = 0;
                $('input', scrollContainer).off('focus.jsp');
            };

            var _bitcoinValidation = function() {

                const $input = $('#affi-bitcoin-address');
                const megaInput = $input.data('MegaInputs');

                if (validateBitcoinAddress($input.val())) {

                    if (megaInput) {
                        megaInput.showError(l[23322]);
                    }
                    else {
                        msgDialog('warninga', '', l[23322]);
                    }

                    return false;
                }

                affiliateRedemption.requests.second.extra = {an: $input.val()};

                return true;
            };

            const _validation = affiliateRedemption.requests.first.m === 2 ?
                _bitcoinValidation : affiliateRedemption.validateDynamicAccInputs.bind(affiliateRedemption);

            if ($target.hasClass('accept') && _validation()) {

                affiliateRedemption.updateAccInfo();
                __hideSaveDataTip();
            }
            else if ($target.hasClass('cancel')) {
                __hideSaveDataTip();
            }
        });

        // Step 4

        var $step4 = $('.cells.step4', this.$dialog);

        $('.withdraw-txt a', $step4).rebind('click.changeMethod', () => {

            affiliateRedemption.currentStep = 0;
            self.displaySteps();

            return false;
        });
    },

    displaySteps: function() {

        'use strict';

        // If user has a Pro Flexi or Business account, go straight to bitcoin redemption step1
        if (affiliateRedemption.currentStep === 0
                && (u_attr.p === pro.ACCOUNT_LEVEL_BUSINESS || u_attr.p === pro.ACCOUNT_LEVEL_PRO_FLEXI)){
            affiliateRedemption.currentStep = 1;
            affiliateRedemption.requests.first.m = 2;
        }


        // Show and hide contents
        $('.cells.left', this.$dialog).addClass('hidden');
        const $prevBtn = $('.prev-btn', this.$dialog);
        const $nextBtn = $('.next-btn', this.$dialog);
        const buttonText = {0: l[556], 1: l[7348], 2: l[427], 3: l[23367], 4: l[23368]};
        const buttonTextQuota = {0: l[556], 1: l[556], 2: l[427], 3: l[23367], 4: l[23368]};

        const $currentStep = $('.cells.step' + affiliateRedemption.currentStep, this.$dialog);

        affiliateRedemption.$step = $currentStep.removeClass('hidden');

        // Show and hide prev button
        if (affiliateRedemption.currentStep === 1 && affiliateRedemption.requests.first.m === 2){
            $prevBtn.addClass('hidden');
        }
        else if (affiliateRedemption.currentStep > 0) {
            $prevBtn.removeClass('hidden');
        }
        else {
            $prevBtn.addClass('hidden');
        }

        // Timer relates
        if (affiliateRedemption.currentStep > 2 && affiliateRedemption.requests.first.m !== 0) {
            affiliateRedemption.startTimer();
        }
        else {
            affiliateRedemption.stopTimer();
        }

        this['displayStep' + affiliateRedemption.currentStep]();
        const textToAdd = affiliateRedemption.requests.first.m === 0 ? buttonTextQuota : buttonText;
        $('span', $nextBtn).text(textToAdd[affiliateRedemption.currentStep]);

        var $cellContent = $('.cell-content', $currentStep);

        if ($currentStep.is('.scrollable') && !$cellContent.hasClass('ps')) {
            Ps.initialize($cellContent[0]);
            $('input', $currentStep).off('focus.jsp');
        }
        else {
            $cellContent.scrollTop(0);
            Ps.update($cellContent[0]);
        }
    },

    displayStep0: function() {

        'use strict';

        $('.next-btn', this.$dialog).removeClass('wide disabled').addClass('small');
        $('.cells.right', this.$dialog).addClass('hidden');
        this.$dialog.addClass('dialog-small').removeClass('disabled');
    },

    displayStep1: function() {

        'use strict';


        const $nextBtn = $('.next-btn', this.$dialog).removeClass('wide');
        $('.cells.right', this.$dialog).removeClass('hidden');
        $('.plan-select-message', this.$dialog).addClass('hidden');
        this.$dialog.removeClass('dialog-small');
        const $bitcoinSummary = $('.cells.right.bitcoin', this.$dialog);
        const $megaquotaSummary = $('.cells.right.megaquota', this.$dialog);
        const $planRadios = $('.affiliate-redeem.plan-selection-wrapper', this.$dialog);

        if (affiliateRedemption.requests.first.m === 0){
            $megaquotaSummary.removeClass('hidden');
            $bitcoinSummary.addClass('hidden');
            $planRadios.removeClass('hidden');

            this.handleProPlans();
        }
        else {
            $bitcoinSummary.removeClass('hidden').addClass('small step1');
            $megaquotaSummary.addClass('hidden');
            $planRadios.addClass('hidden');
            $nextBtn.removeClass('small');

            if (u_attr.p === pro.ACCOUNT_LEVEL_BUSINESS || u_attr.p === pro.ACCOUNT_LEVEL_PRO_FLEXI){
                $('.cells.left .affiliate-redeem.withdraw-txt a', this.$dialog).addClass('hidden');
            }
        }

        const currentPlan = affiliateRedemption.requests.first.m; // 2 = BTC, 0 = MEGAquota

        let $currentStep = $('.cells.step1', this.$dialog);

        if (currentPlan === 0){
            $currentStep.addClass('hidden');
            $currentStep = $('.cells.step1.megaquota', this.$dialog);
            $currentStep.removeClass('hidden');
        }
        else {
            const $amountInput = $('#affiliate-redemption-amount', this.$dialog);
            const $amountMessage = $('.amount-message-container', this.$dialog);
            const megaInput = $amountInput.data('MegaInputs') || new mega.ui.MegaInputs($amountInput, {
                onShowError: function(msg) {
                    $amountMessage.removeClass('hidden').text(msg);
                },
                onHideError: function() {
                    $amountMessage.addClass('hidden');

                }
            });
            const amountValue = megaInput.getValue();
            const method = affiliateRedemption.requests.first.m;
            const minValue = M.affiliate.redeemGateways[method].min || 50;
            if ((amountValue < minValue) || (amountValue > M.affiliate.balance.available) || !amountValue) {
                $nextBtn.addClass('disabled');
            }
            else {
                $nextBtn.removeClass('disabled');
            }

            // Summary table update
            $('.requested.price .euro', this.$dialog).addClass('hidden').text('------');
            $('.requested.price .local', this.$dialog).text(amountValue ? formatCurrency(amountValue) : '------');
            $('.fee.price .euro', this.$dialog).addClass('hidden').text('------');
            $('.fee.price .local', this.$dialog).text('------');
            $('.received.price .euro', this.$dialog).addClass('hidden').text('------');
            $('.received.price .local', this.$dialog).text('------');

            megaInput.hideError();
        }

        // Method text
        $('.withdraw-txt .method-chosen', $currentStep)
            .text(affiliateRedemption.getMethodString(affiliateRedemption.requests.first.m));

    },

    handleProPlans: function() {

        'use strict';

        const updateRadioButtons = (selection) => {
            const options = [4, 1, 2, 3];
            for (const currentOption of options) {
                const $currentRadio = $(`#redemptionOption${currentOption}.megaquota-option`, this.$dialog);
                const $button = $currentRadio.children('.green-active');
                $button.removeClass('radioOn radioOff');
                if (selection === currentOption) {
                    $button.addClass('radioOn');
                }
                else {
                    $button.addClass('radioOff');
                }
            }
            const monthsOptions = ['Claim all commission'];
            for (let i = 1; i <= 24; i++){
                monthsOptions.push(i);
            }
            affiliateRedemption.plan.chosenPlan = selection;
            const defaultMonths = affiliateRedemption.plan.planDuration || l.duration;
            affiliateUI.redemptionDialog.__renderDropdown('redemption-plans', monthsOptions,
                                                          defaultMonths, this.$dialog);
        };

        const fetchPlansData = () => {

            const $proPlanOptionTemplate = $('.megaquota-option-template', this.$dialog);
            const $proPlanOptionArea = $('.megaquota-options-wrapper', this.$dialog);
            $('.megaquota-option', $proPlanOptionArea).remove();

            const acceptedPlans = new Set([4, 1, 2, 3]); // [pro lite, pro 1, pro 2, pro 3]
            for (const currentPlan of pro.membershipPlans) {

                const storageFormatted = bytesToSize(currentPlan[pro.UTQA_RES_INDEX_STORAGE] * 1073741824, 0);
                const storageTxt = l[23789].replace('%1', storageFormatted);
                const bandwidthFormatted = bytesToSize(currentPlan[pro.UTQA_RES_INDEX_TRANSFER] * 1073741824, 0);
                const bandwidthTxt = l[23790].replace('%1', bandwidthFormatted);

                const planNum = currentPlan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL];
                const months = currentPlan[pro.UTQA_RES_INDEX_MONTHS];

                // There is a 12 month and 1 month version for each plan,
                // check that it's the one month version so no duplicate plans shown
                if (acceptedPlans.has(planNum) && months === 1){
                    const $clone = $proPlanOptionTemplate.clone();

                    const planName = pro.getProPlanName(planNum);
                    const id = `redemptionOption${planNum}`;

                    $clone.children('.megaquota-option-label').children('.meqaquota-option-name')
                        .text(planName);
                    $clone.children('.megaquota-option-label').children('.meqaquota-option-information')
                        .text(storageTxt + ' / ' + bandwidthTxt);

                    $clone.removeClass('hidden template').addClass('megaquota-option');
                    $clone.attr('id', id);

                    $proPlanOptionArea.safeAppend($clone.prop('outerHTML'));
                    $proPlanOptionArea.children('#' + id).rebind('click', () => {
                        updateRadioButtons(planNum);
                        this.updateQuotaSummaryTable(planNum);
                    });
                }
            }

        };

        fetchPlansData();
        updateRadioButtons(affiliateRedemption.plan.chosenPlan);
    },

    getFormattedPlanData : (shortform, data) => {

        'use strict';

        shortform = shortform || false;

        // a: amount, la: localAmount, f: fee, lf: localFee, c: currency, m: months, s: storageQuota, t: transferQuota
        const {a, la, f, lf, c, m, s, t} = data === undefined
            ? affiliateRedemption.req1res[0]
            : data;

        let monthsTxt = formatCurrency(m, c, 'number', 3);
        monthsTxt = mega.icu.format(l[922], monthsTxt);

        // shortform ? n TB : n TB transfer quota

        const storageFormatted = bytesToSize(s * 1073741825, 3, 4);
        const storageTxt = shortform ? storageFormatted : l[23789].replace('%1', storageFormatted);
        const bandwidthFormatted = bytesToSize(t * 1073741824, 3, 4);
        const bandwidthTxt = shortform ? bandwidthFormatted : l[23790].replace('%1', bandwidthFormatted);

        return {
            a: formatCurrency(a, 'EUR', 'narrowSymbol'),
            la: formatCurrency(la, c, 'narrowSymbol'),
            f: formatCurrency(f),
            lf: formatCurrency(lf),
            c: c || 'EUR',
            m: monthsTxt,
            s: storageTxt,
            t: bandwidthTxt,
        };
    },

    getCurrentPlanInfo : (selection) => {

        'use strict';

        const planInfo = {
            previousPlanNum : -1,
            planNum : -1,
            monthlyPrice : 0,
            yearlyPrice : 0,
            monthlyPriceEuros: 0,
            yearlyPriceEuros : 0,
            claimAllCommission : false,
            transferQuota : 0,
            storageQuota : 0,
            currency: '',
        };

        for (const currentPlan of pro.membershipPlans) {

            const months = currentPlan[pro.UTQA_RES_INDEX_MONTHS];
            const planNum = currentPlan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL];

            planInfo.previousPlanNum = planInfo.planNum;
            planInfo.planNum = planNum;

            if (planNum === selection && months === 1) {
                planInfo.monthlyPrice = currentPlan[pro.UTQA_RES_INDEX_LOCALPRICE];
                planInfo.monthlyPriceEuros = currentPlan[pro.UTQA_RES_INDEX_PRICE];
                planInfo.transferQuota = currentPlan[pro.UTQA_RES_INDEX_TRANSFER];
            }
            else if (planNum === selection && months === 12){
                planInfo.yearlyPrice = currentPlan[pro.UTQA_RES_INDEX_LOCALPRICE];
                planInfo.yearlyPriceEuros = currentPlan[pro.UTQA_RES_INDEX_PRICE];
            }
            if (planInfo.planNum === selection && planInfo.planNum === planInfo.previousPlanNum
                && planInfo.planNum !== -1 && planInfo.previousPlanNum !== -1){
                planInfo.storageQuota = currentPlan[pro.UTQA_RES_INDEX_STORAGE];
                planInfo.currency = currentPlan[pro.UTQA_RES_INDEX_LOCALPRICECURRENCY];
                break;
            }
        }
        return planInfo;
    },

    updateQuotaSummaryTable : (selection) => {

        'use strict';

        const calculateClaimAllMonths = (availableAmount, pricePerYear, pricePerMonth) => {
            let months = 0;
            let counter = 0;
            while (availableAmount >= pricePerYear && counter <= 100){
                availableAmount -= pricePerYear;
                months += 12;
                counter++;
            }
            months += (availableAmount / pricePerMonth);
            return months;
        };

        affiliateRedemption.plan.chosenPlan = selection || affiliateRedemption.plan.chosenPlan;

        const $summaryTable = $('.quota-summary', this.$dialog);
        const $dropdown = $('.duration-dropdown', this.$dialog);
        const $planSelectMessage = $('.plan-select-message', this.$dialog);
        const $dialogWindow = $('.mega-dialog.affiliate-redeem.dialog-template-tool', self.$dialog);

        let numMonths;

        numMonths = $('.option.active', $dropdown).data('type');
        if (numMonths) {
            $('.redemption-duration-base', $dropdown).removeClass('redemption-duration-default');
            $('.mega-input-title', $dropdown).removeClass('hidden');
        }
        else {
            $('.duration-dropdown .redemption-duration-base', this.$dialog).addClass('redemption-duration-default');
            $('.mega-input-title', $dropdown).addClass('hidden');
        }

        // reset table
        if (!selection || !numMonths) {
            $('.pro-plan .plan-info', $summaryTable).text('-');
            $('.pro-storage .plan-info', $summaryTable).text('-');
            $('.pro-quota .plan-info', $summaryTable).text('-');
            $('.pro-duration .plan-info', $summaryTable).text('-');
            $('.affiliate-redeem .summary-wrap .pro-price .plan-info', this.$dialog)
                .text(formatCurrency('', M.affiliate.balance.localCurrency, 'narrowSymbol').replace('NaN', '-'));
            $('.affiliate-redeem .summary-wrap .pro-price .euro', this.$dialog).addClass('hidden');
            $('.next-btn', this.$dialog).addClass('disabled');
            $('.insufficient-quota-warning', this.$dialog).addClass('hidden');
            $planSelectMessage.removeClass('hidden insufficient-quota-warning').addClass('under-price-warning')
                .text(l.redemption_cost_too_low);
            return;
        }

        const planInfo = affiliateUI.redemptionDialog.getCurrentPlanInfo(selection, numMonths);

        if (numMonths === 'Claim all commission'){
            const claimAllMonths = calculateClaimAllMonths(
                M.affiliate.balance.available, planInfo.yearlyPriceEuros, planInfo.monthlyPriceEuros);
            planInfo.claimAllCommission = true;
            numMonths = claimAllMonths;
        }

        const planName = pro.getProPlanName(planInfo.planNum);

        const monthsCost = planInfo.monthlyPrice * (numMonths % 12);
        const yearsCost = planInfo.yearlyPrice * Math.floor(numMonths / 12);

        const monthsCostEuros = planInfo.monthlyPriceEuros * (numMonths % 12);
        const yearsCostEuros = planInfo.yearlyPriceEuros * Math.floor(numMonths / 12);

        let totalCost;
        let totalCostEuros;
        if (planInfo.claimAllCommission){
            totalCost = M.affiliate.balance.localAvailable;
            totalCostEuros = M.affiliate.balance.available;
        }
        else {
            totalCost = monthsCost + yearsCost;
            totalCostEuros = monthsCostEuros + yearsCostEuros;
        }

        // If the plan is too low cost, reset the table to empty, and warn the user
        // Otherwise remove the warning
        if (totalCostEuros < 49.95) {
            $planSelectMessage.removeClass('hidden insufficient-quota-warning').addClass('under-price-warning')
                .text(l.redemption_cost_too_low);
            affiliateUI.redemptionDialog.updateQuotaSummaryTable();
            return;
        }
        $planSelectMessage.addClass('hidden');

        totalCostEuros = totalCostEuros.toFixed(8);
        totalCost = (totalCostEuros * pro.conversionRate).toFixed(8);

        const dataToFormat = {
            a: totalCostEuros,
            la: totalCost,
            f: 0,
            lf: 0,
            c: planInfo.currency,
            m: numMonths,
            s: planInfo.storageQuota,
            t: planInfo.transferQuota * numMonths
        };

        const {a, la, m, s, t, c} = affiliateUI.redemptionDialog.getFormattedPlanData(true, dataToFormat);

        $('.pro-plan .plan-info', $summaryTable).text(planName);
        $('.pro-storage .plan-info', $summaryTable).text(s);
        $('.pro-quota .plan-info', $summaryTable).text(t);
        $('.pro-duration .plan-info', $summaryTable).text(m);
        if (!c || c === 'EUR') {
            $('.affiliate-redeem .summary-wrap .pro-price .plan-info', this.$dialog).text(a + '*');
            $('.affiliate-redeem .summary-wrap .pro-price .euro', this.$dialog).addClass('hidden');
        }
        else {
            $('.affiliate-redeem .summary-wrap .pro-price .plan-info', this.$dialog).text(la + '*');
            $('.affiliate-redeem .summary-wrap .pro-price .euro', this.$dialog).text(a).removeClass('hidden');
        }

        affiliateRedemption.plan.planName = planName;
        affiliateRedemption.plan.planPriceRedeem = totalCostEuros;


        const $nextBtn = $('.next-btn', this.$dialog);

        const cost = affiliateRedemption.plan.planPriceRedeem;
        const method = affiliateRedemption.requests.first.m;
        const minValue = M.affiliate.redeemGateways[method].min || 50;

        if (affiliateRedemption.plan.chosenPlan !== -1 && numMonths
            && cost >= minValue && cost <= M.affiliate.balance.available){
            $nextBtn.removeClass('disabled');
        }
        else {
            $nextBtn.addClass('disabled');
        }
        if (cost > M.affiliate.balance.available){
            $planSelectMessage.removeClass('hidden under-price-warning').addClass('insufficient-quota-warning')
                .text(l.redemption_insufficient_available_commission);
        }
        else {
            $planSelectMessage.addClass('hidden');
        }
    },

    durationDropdownHandler: function($select) {

        'use strict';

        const $dropdownItem = $('.option', $select);
        $dropdownItem.rebind('click.inputDropdown', function() {

            const $this = $(this);

            if ($this.hasClass('disabled')) {
                return;
            }

            const months = parseInt($this.data('type'));

            $select.removeClass('error');
            const $item = $('> span', $select);
            $dropdownItem.removeClass('active').removeAttr('data-state');
            $this.addClass('active').attr('data-state', 'active');
            const $dropdownSave = $('.dropdown-item-save', $item);
            const newText = $('.dropdown-item-text', $this).text();
            if (months % 12 === 0) {
                $dropdownSave.removeClass('hidden');
            }
            else {
                $dropdownSave.addClass('hidden');
            }
            $('.dropdown-text', $item).text(newText);
            $item.removeClass('placeholder');
            $this.trigger('change');
        });
    },

    calculatePrice : function(months, monthlyPrice, yearlyPrice) {

        'use strict';

        const monthsCost = monthlyPrice * (months % 12);
        const yearsCost = yearlyPrice * Math.floor(months / 12);
        return monthsCost + yearsCost;
    },

    setActive : function(type, activeItem, $dropdown, $currentStep) {

        'use strict';

        if (type === 'redemption-plans') {
            this.durationDropdownHandler($dropdown);
            let currentText;
            if (activeItem === 'Claim all commission') {
                currentText = l.redemption_claim_max_months;
            }
            else if (parseInt(activeItem)) {
                currentText = mega.icu.format(l[922], activeItem);
            }
            else {
                currentText = activeItem;
                currentText = parseInt(activeItem) ? mega.icu.format(l[922], activeItem) : activeItem;
            }
            this.updateQuotaSummaryTable(affiliateRedemption.plan.chosenPlan);
            $('#affi-' + type + ' > span span.dropdown-text', $currentStep).text(currentText);
        }
        else {
            $('#affi-' + type + ' > span', $currentStep)
                .text(type === 'country' ? M.getCountryName(activeItem) : activeItem);
        }
    },

    __renderDropdown : function(type, list, activeItem, $currentStep) {

        'use strict';

        const $selectItemTemplate = $('.templates .dropdown-templates .select-item-template', this.$dialog);
        const $dropdown = $('#affi-' + type, $currentStep);

        let planInfo;
        let monthlyPrice;
        let yearlyPrice;

        if (type === 'redemption-plans') {
            $('.duration-dropdown', this.$dialog).rebind("change", () => {
                const chosenDuration = $('.option.active', '.duration-dropdown').data('type');
                affiliateRedemption.plan.planDuration = chosenDuration.toString();
                this.updateQuotaSummaryTable(affiliateRedemption.plan.chosenPlan);
            });
            $('.dropdown-scroll', $dropdown).empty();
            planInfo = this.getCurrentPlanInfo(affiliateRedemption.plan.chosenPlan);
            monthlyPrice = planInfo.monthlyPriceEuros || 0;
            yearlyPrice = planInfo.yearlyPriceEuros || 0;
            const price = this.calculatePrice(activeItem, monthlyPrice, yearlyPrice);
            if ((isNaN(price) || price < 49.95) && affiliateRedemption.plan.planDuration !== 'Claim all commission'){
                activeItem = l.duration;
                affiliateRedemption.plan.planDuration = undefined;
            }
        }

        $('.mega-input-dropdown', $currentStep).addClass('hidden');

        for (let i = 0; i < list.length; i++) {

            const $clone = $selectItemTemplate.clone().removeClass('select-item-template');
            $clone.remove();

            const item = escapeHTML(list[i]);
            let displayName;
            if (type === 'country'){
                displayName = M.getCountryName(item);
            }
            else if (type === 'redemption-plans'){

                const cost = this.calculatePrice(i, monthlyPrice, yearlyPrice);

                displayName = item === 'Claim all commission'
                    ? l.redemption_claim_max_months
                    : mega.icu.format(l[922], item);
                if (item % 12 === 0){
                    $clone.children('.dropdown-item-save').removeClass('hidden').text(l.redemption_save_16_percent);
                }
                if (cost < 49.95 && item !== 'Claim all commission') {
                    $clone.addClass('disabled');
                }
            }
            else {
                displayName = item;
            }
            const state = item === activeItem ? 'active' : '';
            $clone.attr({"data-type": item, "data-state": state});
            $clone.children('.dropdown-item-text').text(displayName);
            $clone.addClass(state);
            $('.dropdown-scroll', $dropdown).safeAppend($clone.prop('outerHTML'));
        }

        bindDropdownEvents($dropdown);
        this.setActive(type, activeItem, $dropdown, $currentStep);
    },


    displayStep2: function() {

        'use strict';

        var $currentStep = $('.cells.step2', this.$dialog);
        $('.cells.right.bitcoin', this.$dialog).removeClass('step1');

        // Method text
        $('.withdraw-txt .method-chosen', $currentStep)
            .text(affiliateRedemption.getMethodString(affiliateRedemption.requests.first.m));

        // Summary table update
        $('.requested.price .euro', this.$dialog).addClass('hidden').text('------');
        $('.requested.price .local', this.$dialog)
            .text(formatCurrency(affiliateRedemption.requests.first.p));
        $('.fee.price .euro', this.$dialog).addClass('hidden').text('------');
        $('.fee.price .local', this.$dialog).text('------');
        $('.received.price .euro', this.$dialog).addClass('hidden').text('------');
        $('.received.price .local', this.$dialog).text('------');

        // Country and currency
        var selectedGWData = M.affiliate.redeemGateways[affiliateRedemption.requests.first.m];
        var seletedGWDefaultData = selectedGWData.data.d || [];
        var activeCountry = affiliateRedemption.requests.first.cc || seletedGWDefaultData[0] ||
            selectedGWData.data.cc[0];
        var activeCurrency = affiliateRedemption.requests.first.c || seletedGWDefaultData[1] ||
            selectedGWData.data.$[0];

        this.__renderDropdown('country', selectedGWData.data.cc, activeCountry, $currentStep);
        this.__renderDropdown('currency', selectedGWData.data.$, activeCurrency, $currentStep);


        // If this is bitcoin redemption
        if (affiliateRedemption.requests.first.m === 2) {

            var megaInput = new mega.ui.MegaInputs($('#affi-bitcoin-address', $currentStep));

            megaInput.hideError();

            $('.affi-withdraw-currency, .currency-tip', $currentStep).addClass('hidden');
            $('.bitcoin-data', $currentStep).removeClass('hidden');

            if (M.affiliate.redeemAccDefaultInfo && M.affiliate.redeemAccDefaultInfo.an) {

                // Autofill bitcoin address
                $('.save-bitcoin-checkbox', $currentStep).addClass('hidden');
                $('.bitcoin-fill-checkbox', $currentStep).removeClass('hidden');
            }
            else {

                // Save bitcoin address
                $('.save-bitcoin-checkbox', $currentStep).removeClass('hidden');
                $('.bitcoin-fill-checkbox', $currentStep).addClass('hidden');
            }
        }
        else {
            $('.affi-withdraw-currency, .currency-tip', $currentStep).removeClass('hidden');
            $('.bitcoin-data', $currentStep).addClass('hidden');
        }
    },

    displayStep3: function() {

        'use strict';

        var self = this;
        var $currentStep = $('.cells.step3', this.$dialog);
        var selectItemTemplate = '<div class="option @@" data-state="@@" data-type="@@">@@</div>';
        var ccc = affiliateRedemption.requests.first.cc + affiliateRedemption.requests.first.c;
        var req1 = affiliateRedemption.requests.first;
        var req1res = affiliateRedemption.req1res[0];

        // Summary table update
        if (req1.c !== 'EUR') {
            $('.requested.price .euro', this.$dialog).removeClass('hidden')
                .text(`(${formatCurrency(req1.p)})`);
            $('.fee.price .euro', this.$dialog).removeClass('hidden')
                .text(`(${formatCurrency(req1res.f)})`);
            $('.received.price .euro', this.$dialog).removeClass('hidden')
                .text(`(${formatCurrency(affiliateRedemption.requests.first.p - req1res.f)})`);
        }

        if (affiliateRedemption.requests.first.m === 2) {

            $('.requested.price .local', this.$dialog)
                .text('BTC ' + parseFloat(req1res.la).toFixed(8));
            $('.fee.price .local', this.$dialog).text('BTC ' + parseFloat(req1res.lf).toFixed(8) + '*');
            $('.received.price .local', this.$dialog).text('BTC ' + (req1res.la - req1res.lf).toFixed(8));

            // This is Bitcoin method just render summary table and proceed.
            return;
        }

        $('.requested.price .local', this.$dialog)
            .text(formatCurrency(req1res.la, req1res.lc, 'code'));
        $('.fee.price .local', this.$dialog)
            .text(formatCurrency(req1res.lf, req1res.lc, 'code') + (req1.c === 'EUR' ? '' : '*'));
        $('.received.price .local', this.$dialog)
            .text(formatCurrency(req1res.la - req1res.lf, req1res.lc, 'code'));

        // Save account relates
        var $autofillCheckbox = $('.auto-fill-checkbox', $currentStep);
        var $saveCheckbox = $('.save-data-checkbox', $currentStep);

        $('.save-data-tip', $currentStep).addClass('hidden');

        var __showHideCheckboxes = function() {
            // If there is saved data and it is same country and currency code, let user have autofill
            if (M.affiliate.redeemAccDefaultInfo && M.affiliate.redeemAccDefaultInfo.ccc === ccc) {

                // If saved data exist
                $autofillCheckbox.removeClass('hidden');
                $saveCheckbox.addClass('hidden');
            }
            else {
                // If saved data do not exist
                $autofillCheckbox.addClass('hidden');
                $saveCheckbox.removeClass('hidden');
            }
        };

        __showHideCheckboxes();

        var $accountType = $('.affi-dynamic-acc-type', $currentStep);
        var $selectTemplate = $('.affi-dynamic-acc-select.template', $currentStep);
        var accNameMegaInput = new mega.ui.MegaInputs($('#affi-account-name', this.$dialog));

        accNameMegaInput.hideError();

        if (!affiliateRedemption.requests.second.extra) {

            $('input', $autofillCheckbox).prop('checked', false);
            $('.checkdiv', $autofillCheckbox).removeClass('checkboxOn').addClass('checkboxOff');
            accNameMegaInput.setValue('');
            $accountType.empty();
        }
        else if (!affiliateRedemption.requests.second.extra.an) {
            accNameMegaInput.setValue('');
        }
        else if (!affiliateRedemption.requests.second.extra.type) {
            $accountType.empty();
        }

        var accTypes = affiliateRedemption.req1res[0].data;

        // There is dynamic account info required for this.
        // But if there is already any dynamic input(i.e. it is from step 4) skip rendering
        if (accTypes && Object.keys(affiliateRedemption.dynamicInputs).length === 0) {

            $('.affi-dynamic-acc-info', this.$dialog).empty();

            // This has multiple account type, therefore let user select it.
            if (accTypes.length > 1) {

                var $accountSelector = $selectTemplate.clone().removeClass('template');

                $('.mega-input-title', $accountSelector).text(l[23394]);
                $accountSelector.attr('id', 'account-type');
                $('span', $accountSelector).text(l[23366]);

                var html = '';
                var safeArgs = [];
                for (var i = 0; i < accTypes.length; i++) {
                    html += selectItemTemplate;
                    safeArgs.push(accTypes[i][0], accTypes[i][0], i, accTypes[i][1]);
                }

                safeArgs.unshift(html);

                var $optionWrapper = $('.dropdown-scroll', $accountSelector);

                $optionWrapper.safeHTML.apply($optionWrapper, safeArgs);

                $accountType.safeAppend($accountSelector.prop('outerHTML'));

                bindDropdownEvents($('#account-type', $accountType));

                $('#account-type .option' , $accountType).rebind('click.accountTypeSelect', function() {

                    $accountType.parent().removeClass('error');

                    // Type changed reset dynamic inputs
                    affiliateRedemption.dynamicInputs = {};
                    self.renderDynamicAccInputs($(this).data('type'));

                    if (!M.affiliate.redeemAccDefaultInfo || M.affiliate.redeemAccDefaultInfo.ccc !== ccc) {
                        $saveCheckbox.removeClass('hidden');
                    }

                    Ps.update($('.cell-content', $currentStep)[0]);
                    $('input', $currentStep).off('focus.jsp');
                });
            }
            else {
                this.renderDynamicAccInputs(0);
            }
        }
    },

    displayStep4: function() {

        'use strict';

        if (affiliateRedemption.requests.first.m === 0) {
            $('.next-btn', this.$dialog).addClass('wide');
        }
        else {
            $('.next-btn', this.$dialog).removeClass('small');
        }
        const $summaryTable = $('.quota-summary', this.$dialog);

        var $currentStep = $('.cells.step4', this.$dialog);

        var firstRequest = affiliateRedemption.requests.first;
        var req1res = affiliateRedemption.req1res[0];

        if (firstRequest.m === 0) {
            $('.bitcoin', $currentStep).addClass('hidden');
            $('.megaquota', $currentStep).removeClass('hidden');

            const $warning1 = $('.affiliate-redeem .selected-plan-warning1', this.$dialog);
            const $warning2 = $('.affiliate-redeem .selected-plan-warning2', this.$dialog);
            const $warning3 = $('.affiliate-redeem .selected-plan-warning3', this.$dialog);
            const newPlan = affiliateRedemption.plan.chosenPlan;
            $warning1.addClass('hidden');
            $warning2.addClass('hidden');
            $warning3.addClass('hidden');
            if (u_attr.p === newPlan){
                $warning3.removeClass('hidden');
            }
            else if (u_attr.p % 4 > newPlan % 4){
                $warning2.removeClass('hidden');
            }
            else if (u_attr.p % 4 < newPlan % 4) {
                $warning1.removeClass('hidden');
            }

            const planName = pro.getProPlanName(affiliateRedemption.plan.chosenPlan);

            const {a, la, m, s, t} = this.getFormattedPlanData(true);

            const $euroArea = $('.affiliate-redeem .summary-wrap .pro-price .euro', this.$dialog);

            $('.pro-plan .plan-info', $summaryTable).text(planName);
            $('.pro-storage .plan-info', $summaryTable).text(s);
            $('.pro-quota .plan-info', $summaryTable).text(t);
            $('.pro-duration .plan-info', $summaryTable).text(m);
            $('.affiliate-redeem .summary-wrap .pro-price .plan-info', this.$dialog).text(la + '*');
            if (affiliateRedemption.req1res[0].c === 'EUR'){
                $euroArea.addClass('hidden');
            }
            else {
                $euroArea.text(a).removeClass('hidden');
            }

        }
        else if (firstRequest.m === 2 && (req1res.lf / req1res.la) > 0.1){
            $('.bitcoin', $currentStep).removeClass('hidden');
            $('.megaquota', $currentStep).addClass('hidden');
            $('.fm-dialog-overlay').off('click.redemptionClose');
            msgDialog('warningb:!^' + l[78] + '!' + l[79], '', l[24964], l[24965], reject => {

                if (reject) {
                    this.hide(true);
                }
                else {
                    $('.fm-dialog-overlay').rebind('click.redemptionClose', this.hide.bind(this, false));
                }
            });

        }
        $('.email', $currentStep).text(u_attr.email);

        affiliateRedemption.redemptionAccountDetails($currentStep, firstRequest.m);

        $('.country', $currentStep).text(M.getCountryName(firstRequest.cc));
        $('.currency', $currentStep).text(firstRequest.m === 2 ? 'BTC' : firstRequest.c);
    },

    __showSaveDataTip: function() {

        'use strict';

        var $step3 = $('.cells.step3', this.$dialog);
        var ccc = affiliateRedemption.requests.first.cc + affiliateRedemption.requests.first.c;

        // If it has saved data for it and country and currency code for saved data is same, show update data tip.
        if (M.affiliate.redeemAccDefaultInfo && M.affiliate.redeemAccDefaultInfo.ccc === ccc) {

            $('.save-data-tip', $step3).removeClass('hidden');
            Ps.update($step3[0].querySelector('.cell-content'));
            $('input', $step3).off('focus.jsp');
        }
    },

    __renderDynamicText: function(textItem, $wrapper) {

        'use strict';

        var $textTemplate = $('.affi-dynamic-acc-input.template', this.$dialog);
        var $input = $textTemplate.clone().removeClass('template');
        var hashedKey = 'm' + MurmurHash3(textItem.key);

        $input.attr({
            title: '@@',
            id: hashedKey,
            minlength: parseInt(textItem.mnl),
            maxlength: parseInt(textItem.mxl)
        });

        $wrapper.safeAppend($input.prop('outerHTML'), textItem.name);

        $input = $('#' + hashedKey, $wrapper);
        var megaInput = new mega.ui.MegaInputs($input);

        // This is executed to avoid double escaping display in text. updateTitle use text() so safe from XSS.
        megaInput.updateTitle(textItem.name);

        if (textItem.example) {

            $input.parent().addClass('no-trans');
            megaInput.showMessage(l[23375].replace('%eg', textItem.example), true);
        }

        if (textItem.vr) {
            $input.data('_vr', textItem.vr);
        }

        affiliateRedemption.dynamicInputs[hashedKey] = ['t', $input, textItem.key];
    },

    __renderDynamicSelect: function(selectItem, $wrapper) {

        'use strict';

        var self = this;
        var $selectTemplate = $('.affi-dynamic-acc-select.template', this.$dialog);
        var selectItemTemplate = '<div class="option %c" data-type="@@" data-state="%s">@@</div>';
        var $currentStep = $('.cells.step3', this.$dialog);
        var defaultCountry;
        var hashedKey = 'm' + MurmurHash3(selectItem.key);

        // If there is any country in the gw requested input, prefill it with what already selected.
        if (selectItem.key.indexOf('country') > -1) {
            defaultCountry = affiliateRedemption.requests.first.cc;
        }

        // This may need to be changed to actual Mega input later.
        var $select = $selectTemplate.clone().removeClass('template');

        $('.mega-input-title', $select).text(selectItem.name);
        $select.attr({id: hashedKey, title: escapeHTML(selectItem.name)});

        var selectHtml = '';
        var safeArgs = [];
        var hasActive = false;

        for (var j = 0; j < selectItem.va.length; j++) {

            var option = selectItem.va[j];
            var selectItemHtml = selectItemTemplate;

            safeArgs.push(option.key, option.name);

            if ((!defaultCountry && j === 0) || (defaultCountry && defaultCountry === option.key)) {
                selectItemHtml = selectItemHtml.replace('%c', 'active').replace('%s', 'active');
                $('span', $select).text(option.name);
                hasActive = true;
            }
            else {
                selectItemHtml = selectItemHtml.replace('%c', '').replace('%s', '');
            }

            selectHtml += selectItemHtml;
        }

        safeArgs.unshift(selectHtml);

        var $optionWrapper = $('.dropdown-scroll', $select);

        $optionWrapper.safeHTML.apply($optionWrapper, safeArgs);

        // If non of option is active with above looping, select first one
        if (!hasActive) {
            $('.option', $optionWrapper).first().addClass('active');
        }

        $wrapper.safeAppend($select.prop('outerHTML'));

        $select = $('#' + hashedKey, $wrapper);
        bindDropdownEvents($select, 0, '.mega-dialog.affiliate-redeem');
        affiliateRedemption.dynamicInputs[hashedKey] = ['s', $select, selectItem.key];

        $('.mega-input-dropdown', $select).rebind('click.removeError', function(e) {

            if ($(e.target).data('type') !== '') {
                $(this).parents('.mega-input.dropdown-input').removeClass('error');
            }
        });

        // There is extra data requires for this. Lets pull it again
        if (selectItem.rroc) {

            $wrapper.safeAppend('<div class="extraWrapper" data-parent="@@"></div>', hashedKey);

            $('.option', $select).rebind('click.showAdditionalInput', function() {

                var $extraWrapper = $('.extraWrapper[data-parent="' + hashedKey + '"]', $wrapper).empty();
                affiliateRedemption.clearDynamicInputs();

                // Temporary record for second request as it requires for afftrc.
                affiliateRedemption.recordSecondReqValues();

                loadingDialog.show('rroc');
                self.$dialog.addClass('arrange-to-back');

                M.affiliate.getExtraAccountDetail().then(function(res) {

                    self.$dialog.removeClass('arrange-to-back');

                    var additions = res.data[0];
                    var subtractions = res.data[1];

                    for (var i = 0; i < subtractions.length; i++) {
                        $('#m' + MurmurHash3(subtractions[i].key)).parent().remove();
                    }

                    for (var j = 0; j < additions.length; j++) {

                        var hashedAddKey = 'm' + MurmurHash3(additions[j].key);

                        if ($('#' + hashedAddKey, self.$dialog).length === 0) {

                            if (additions[j].va) {
                                self.__renderDynamicSelect(additions[j], $extraWrapper);
                            }
                            else {
                                self.__renderDynamicText(additions[j], $extraWrapper);
                            }
                        }

                        var $newElem = $('#' + hashedAddKey, self.$dialog);
                        var parentHashedKey = $newElem.parents('.extraWrapper').data('parent');
                        var parentDynamicInput = affiliateRedemption.dynamicInputs[parentHashedKey];
                        var defaultInfo = M.affiliate.redeemAccDefaultInfo;

                        // This is may triggered by autofill
                        if ($('.auto-fill-checkbox input', self.$dialog).prop('checked') &&
                            $('.active', parentDynamicInput[1]).data('type') === defaultInfo[parentDynamicInput[2]]) {

                            if (additions[j].va) {
                                const selectedValue = defaultInfo[additions[j].key];
                                setDropdownValue(
                                    $newElem,
                                    ($dropdownInput) => {
                                        if (!$dropdownInput.length) {
                                            return;
                                        }
                                        return $(`[data-type="${selectedValue}"]`, $dropdownInput);
                                    }
                                );
                            }
                            else {
                                $newElem.val(defaultInfo[additions[j].key]);
                            }
                        }
                    }

                    $('.option', $extraWrapper)
                        .rebind('click.showSaveTooltip', self.__showSaveDataTip.bind(self));

                    affiliateRedemption.clearDynamicInputs();

                    // Lets remove temporary added data for afftrc.
                    affiliateRedemption.requests.second = {};

                    Ps.update($currentStep[0]);

                    $('input', $currentStep).off('focus.jsp');

                    loadingDialog.hide('rroc');
                }).catch(function(ex) {

                    if (d) {
                        console.error('Extra data pulling error, response:' + ex);
                    }

                    self.$dialog.removeClass('arrange-to-back');
                    msgDialog('warninga', l[7235], l[200] + ' ' + l[253]);
                });
            });

            onIdle(function() {
                $('.option.active', $select).trigger('click.showAdditionalInput');
            });
        }
    },

    renderDynamicAccInputs: function(accountType) {

        'use strict';

        var self = this;
        var $accountInfo = $('.affi-dynamic-acc-info', this.$dialog).empty();
        var $currentStep = $('.cells.step3', this.$dialog);
        var affr1Res = affiliateRedemption.req1res[0];
        var dynamicRequirements = affr1Res.data[accountType][2];

        // If this is not array something is wrong, and cannot proceed due to lack of information for the transaction
        if (!Array.isArray(dynamicRequirements)) {
            return false;
        }

        for (var i = 0; i < dynamicRequirements.length; i++) {

            var item = dynamicRequirements[i];

            // This is select input
            if (item.va) {
                self.__renderDynamicSelect(item, $accountInfo);
            }

            // This is text input
            else {
                self.__renderDynamicText(item, $accountInfo);
            }
        }

        // After rendering, make bind for any input on this stage will show save tooltip when condition met
        $('input[type="text"]', $currentStep).rebind('input.showSaveTooltip', this.__showSaveDataTip.bind(this));
        $('.option', $currentStep).rebind('click.showSaveTooltip', this.__showSaveDataTip.bind(this));
    },
};

/*
 * Redemption history section
 */
affiliateUI.redemptionHistory = {

    init: function() {

        'use strict';

        this.$block = $('.mega-data-box.redemption', affiliateUI.$body);
        this.$dropdown = $('.dropdown-input.affiliate-redemption', this.$block);

        // Initial table view for redemption history, no filter, default sort
        this.list = M.affiliate.redemptionHistory.r;
        this.sort = 'ts';
        this.sortd = 1;
        this.filter = 'all';

        this.drawTable();
        this.bindEvents();
    },

    bindEvents: function() {

        'use strict';

        var self = this;

        $('th.sortable', self.$block).rebind('click', function() {

            var $this = $(this);
            var $icon = $('i', $this);

            self.sort = $this.data('type');

            if ($icon.hasClass('desc')) {

                $('.mega-data-box th.sortable i', this.$block)
                    .removeClass('desc asc sprite-fm-mono icon-dropdown');

                $icon.addClass('sprite-fm-mono icon-dropdown asc');
                self.sortd = -1;
            }
            else {

                $('.mega-data-box th.sortable i', this.$block)
                    .removeClass('desc asc sprite-fm-mono icon-dropdown');

                $icon.addClass('sprite-fm-mono icon-dropdown desc');
                self.sortd = 1;
            }

            self.updateList();
            self.drawTable();
            self.bindEvents();
        });

        $(window).rebind('resize.affiliate', self.initRedeemResizeNScroll);

        // Init redeem detail View/Close link click
        $('.redeem-table .link', self.$block).rebind('click.redemptionItemExpand', function() {

            var $this = $(this);
            var $table = $this.closest('.redeem-scroll');
            var $detailBlock = $this.parents('.redeem-summary').next('.redeem-details');

            if ($this.hasClass('open')) {

                // This scroll animation is using CSS animation not jscrollpane animation because it is too heavy.
                var $scrollBlock = $this.parents('.redeem-scroll').addClass('animateScroll');
                $('.expanded', $table).removeClass('expanded');

                var rid = $this.data('rid');
                const state = $this.data('state');

                // After scrolling animation and loading is finihsed expand the item.
                M.affiliate.getRedemptionDetail(rid, state).then((res) => {

                    affiliateRedemption.fillBasicHistoryInfo($detailBlock, res, state);
                    affiliateRedemption.redemptionAccountDetails($detailBlock, res.gw, res);

                    $table.addClass('expanded-item');
                    $this.closest('tr').addClass('expanded');

                    self.initRedeemResizeNScroll();

                    $scrollBlock.scrollTop($this.parents('tr').position().top);

                    // Just waiting animation to be finihsed
                    setTimeout(function() {
                        $scrollBlock.removeClass('animateScroll');
                    }, 301);
                }).catch(function(ex) {

                    if (d) {
                        console.error('Getting redemption detail failed, rid: ' + rid, ex);
                    }

                    msgDialog('warninga', '', l[200] + ' ' + l[253]);
                });
            }
            else {
                $table.removeClass('expanded-item');
                $this.closest('tr').removeClass('expanded').prev().removeClass('expanded');
                self.initRedeemResizeNScroll();
            }
        });

        bindDropdownEvents(self.$dropdown, false, affiliateUI.$body);

        // Click event for item on filter dropdown
        $('.option', self.$dropdown).rebind('click.showList', function() {

            var $this = $(this);

            if (self.filter === $this.data('type')) {
                return false;
            }

            self.filter = $this.data('type');
            self.updateList();
            self.drawTable();
            self.bindEvents();
        });
    },

    updateList: function() {

        'use strict';

        var self = this;

        this.list = M.affiliate.getFilteredRedempHistory(this.filter);
        this.list.sort(function(a, b) {

            if (a[self.sort] > b[self.sort]) {
                return -1 * self.sortd;
            }
            else if (a[self.sort] < b[self.sort]) {
                return self.sortd;
            }

            // Fallback with timestamp
            if (a.ts > b.ts) {
                return -1 * self.sortd;
            }
            else if (a.ts < b.ts) {
                return self.sortd;
            }
            return 0;
        });
    },

    drawTable: function() {

        'use strict';

        var $noRedemptionBlock = $('.no-redemption', this.$block);
        var $itemBlock = $('.redeem-scroll', this.$block);
        var $table = $('.redeem-table.main', $itemBlock);
        var $itemSummaryTemplate = $('.redeem-summary.template', $table);
        var $itemDetailTemplate = $('.redeem-details.template', $table);

        $('tr:not(:first):not(.template)', $table).remove();

        if (this.list.length) {

            $noRedemptionBlock.addClass('hidden');
            $itemBlock.removeClass('hidden');

            var html = '';

            for (var i = 0; i < this.list.length; i++) {

                var item = this.list[i];
                let proSuccessful;
                if (item.gw === 0) {
                    if (item.hasOwnProperty('state')) {
                        proSuccessful = item.state === 4;
                    }
                    else {
                        proSuccessful = item.s === 4;
                    }
                }
                var itemStatus = affiliateRedemption.getRedemptionStatus(item.s, proSuccessful);
                var la = parseFloat(item.la);

                // Filling item data for the summary part
                var $itemSummary = $itemSummaryTemplate.clone().removeClass('hidden template')
                    .addClass(itemStatus.class);

                $('.receipt', $itemSummary).text(item.ridd || item.rid);
                $('.date', $itemSummary).text(time2date(item.ts, 1));
                $('.method', $itemSummary).text(affiliateRedemption.getMethodString(item.gw));
                if (item.c === 'XBT') {
                    $('.amount', $itemSummary).text('BTC ' + la.toFixed(8));
                }
                else {
                    $('.amount', $itemSummary).text(formatCurrency(la, item.c, 'code'));
                }
                $('.status span', $itemSummary).addClass(itemStatus.c).text(itemStatus.s);
                $('.link', $itemSummary).attr('data-rid', item.rid).attr('data-state', item.s);

                // Lets prefill details part to reduce looping
                var $itemDetail = $itemDetailTemplate.clone().removeClass('template');

                html += $itemSummary.prop('outerHTML') + $itemDetail.prop('outerHTML');
            }

            $('tbody', $table).safeAppend(html);

            this.initRedeemResizeNScroll();
        }
        else {
            $noRedemptionBlock.removeClass('hidden');
            $itemBlock.addClass('hidden');
        }
    },

    // Init redeem content scrolling and table header resizing
    initRedeemResizeNScroll: function() {

        'use strict';

        // If list is empty, do not need to abjust the view.
        if (!M.affiliate.redemptionHistory || M.affiliate.redemptionHistory.r.length === 0) {
            return false;
        }

        var $scrollElement = $('.redeem-scroll', this.$block);

        if ($scrollElement.hasClass('ps')) {
            Ps.update($scrollElement[0]);
        }
        else {
            Ps.initialize($scrollElement[0]);
        }

        var $header = $('.redeem-table.main th', this.$block);

        for (var i = 0; i < $header.length; i++) {
            var $clonedHeader = $('.redeem-table.clone th', this.$block);

            if ($clonedHeader.eq(i).length) {
                $clonedHeader.eq(i).outerWidth($header.eq(i).outerWidth());
            }
        }

        // Remove default focus scrolling from jsp
        $('a', $scrollElement).off('focus.jsp');
    },
};

/*
 * Registration index section
 */
affiliateUI.registrationIndex = {

    init: function() {

        'use strict';

        this.$registerChartBlock = $('.mega-data-box.registration', affiliateUI.$body);
        this.type = $('.fm-affiliate.chart-period.active', this.$registerChartBlock).data('type');

        this.bindEvents();
        this.calculateTotal();
        this.setChartTimeBlock();
        this.drawChart();
    },

    bindEvents: function() {

        'use strict';

        var self = this;
        var $buttons = $('.fm-affiliate.chart-period', this.$registerChartBlock);
        var $datesWrapper = $('.fm-affiliate.chart-dates', this.$registerChartBlock);

        $buttons.rebind('click.chooseChartPeriod', function() {

            $buttons.removeClass('active');
            this.classList.add('active');

            self.type = this.dataset.type;
            self.setChartTimeBlock();
            self.drawChart();
        });

        $datesWrapper.rebind('click.selectDateRange', function(e) {

            var classList = e.target.classList;

            if (classList.contains('prev-arrow') && !classList.contains('disabled')) {
                self.setChartTimeBlock(self.start - 1);
            }
            else if (classList.contains('next-arrow') && !classList.contains('disabled')) {
                self.setChartTimeBlock(self.end + 1);
            }
            else {
                return false;
            }

            self.drawChart();
        });
    },

    /**
     * Calculate Total registerations and incremented value over last month
     * @returns {Void} void function
     */
    calculateTotal: function() {

        'use strict';

        this.total = M.affiliate.signupList.length;

        $('.affiliate-total-reg', this.$registerChartBlock).text(this.total);

        var thisMonth = calculateCalendar('m');

        var thisMonthCount = 0;

        M.affiliate.signupList.forEach(function(item) {
            if (thisMonth.start <= item.ts && item.ts <= thisMonth.end) {
                thisMonthCount++;
            }
        });

        $('.charts-head .compare span', this.$registerChartBlock).text(thisMonthCount);
    },

    /**
     * Set period block(start and end times) to render chart, depends on time given, type of period.
     * @param {Number} unixTime unixtime stamp given.
     * @returns {Void} void function
     */
    setChartTimeBlock: function(unixTime) {

        'use strict';

        var $datesBlock = $('.fm-affiliate.chart-dates .dates', affiliateUI.$body);
        var calendar = calculateCalendar(this.type || 'w', unixTime);

        this.start = calendar.start;
        this.end = calendar.end;

        if (this.type === 'w') {
            var startDate = acc_time2date(this.start, true);
            var endDate = acc_time2date(this.end, true);

            $datesBlock.text(l[22899].replace('%d1' ,startDate).replace('%d2' ,endDate));
        }
        else if (this.type === 'm') {
            $datesBlock.text(time2date(this.start, 3));
        }
        else if (this.type === 'y') {
            $datesBlock.text(new Date(this.start * 1000).getFullYear());
        }

        var startlimit = 1577836800;
        var endlimit = Date.now() / 1000;
        var $prevBtn = $('.fm-affiliate.chart-dates .prev-arrow', affiliateUI.$body).removeClass('disabled');
        var $nextBtn = $('.fm-affiliate.chart-dates .next-arrow', affiliateUI.$body).removeClass('disabled');

        if (this.start < startlimit) {
            $prevBtn.addClass('disabled');
        }

        if (this.end > endlimit) {
            $nextBtn.addClass('disabled');
        }
    },

    /**
     * Set labels for the chart depends on type of period.
     * @returns {Array} lbl An array of labels
     */
    getLabels: function() {

        'use strict';

        var lbl = [];

        if (this.type === 'w') {
            for (var i = 0; i <= 6; i++) {
                lbl.push(time2date(this.start + i * 86400, 10).toUpperCase());
            }
        }
        else if (this.type === 'm') {
            var endDateOfMonth = new Date(this.end * 1000).getDate();

            for (var k = 1; k <= endDateOfMonth; k++) {
                lbl.push(k);
            }
        }
        else if (this.type === 'y') {

            var startDate = new Date(this.start * 1000);
            lbl.push(time2date(startDate.getTime() / 1000, 12).toUpperCase());

            for (var j = 0; j <= 10; j++) {
                startDate.setMonth(startDate.getMonth() + 1);
                lbl.push(time2date(startDate.getTime() / 1000, 12).toUpperCase());
            }
        }

        return lbl;
    },

    /**
     * Lets draw chart with settled options and data.
     * @returns {Void} void function
     */
    drawChart: function() {

        'use strict';

        var self = this;
        var labels = this.getLabels();
        var data = [];

        if (this.chart) {
            this.chart.destroy();
        }

        M.affiliate.signupList.forEach(function(item) {
            if (self.start <= item.ts && item.ts <= self.end) {
                var val;
                switch (self.type) {
                    case 'w':
                        val = time2date(item.ts, 10).toUpperCase();
                        break;
                    case 'm':
                        val = new Date(item.ts * 1000).getDate();
                        break;
                    case 'y':
                        val = time2date(item.ts, 12).toUpperCase();
                        break;
                }

                var index = labels.indexOf(val);

                data[index] = data[index] + 1 || 1;
            }
        });

        var $chartWrapper = $('.mega-data-box.registration', affiliateUI.$body);
        var $ctx = $('#register-chart', $chartWrapper);
        var chartColor1 = $ctx.css('--label-blue');
        var chartColor2 = $ctx.css('--label-blue-hover');
        var dividerColor = $ctx.css('--surface-grey-2');
        var textColor = $ctx.css('--text-color-low');
        var ticksLimit = 6;

        $ctx.outerHeight(186);

        //  TODO: set ticksLimit=4 for all months after library update
        if (this.type === 'm') {
            var daysInMonth = new Date(this.end * 1000).getDate();

            ticksLimit = daysInMonth === 28 ? 5 : 4;
        }

        this.chart = new Chart($ctx[0], {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: chartColor1,
                    hoverBackgroundColor: chartColor2,
                    borderWidth: 1,
                    borderColor: chartColor1.replace(/^\s/ , '')
                }]
            },
            options: {
                barRoundness: 1,
                maintainAspectRatio: false,
                legend: {
                    display: false
                },
                responsive: true,
                scales: {
                    xAxes: [{
                        display: true,
                        maxBarThickness: 8,
                        gridLines : {
                            display : false
                        },
                        ticks: {
                            fontColor: textColor,
                            fontSize: 12,
                            autoSkip: true,
                            maxTicksLimit: ticksLimit,
                            maxRotation: 0
                        }
                    }],
                    yAxes: [{
                        display: true,
                        ticks: {
                            fontColor: textColor,
                            fontSize: 12,
                            beginAtZero: true,
                            precision: 0,
                            suggestedMax: 4
                        },
                        gridLines: {
                            color: dividerColor,
                            zeroLineColor: dividerColor,
                            drawBorder: false,
                        }
                    }]
                },
                tooltips: {
                    displayColors: false,
                    callbacks: {
                        title: function(tooltipItem) {
                            if (self.type === 'm') {
                                var ttDate = new Date(self.start * 1000);
                                ttDate.setDate(tooltipItem[0].xLabel | 0);
                                return acc_time2date(ttDate.getTime() / 1000, true);
                            }
                            return tooltipItem[0].xLabel;
                        }
                    }
                }
            }
        });
    }
};

/**
 * Purchase index
 */
affiliateUI.purchaseIndex = {

    init: function() {

        'use strict';

        this.$purchaseChartBlock = $('.mega-data-box.purchase', affiliateUI.$body);

        this.count();
    },

    getPlans: function(updatePurchaseIndex) {

        'use strict';

        // Set r: 1 so that pro-lite will also be shown
        const payload = {a: 'utqa', nf: 2, p: 1, r: 1};
        api_req(payload, {
            callback: function(results) {

                const plans = [];

                for (var i = 1; i < results.length; i++) {
                    plans.push([
                        results[i].id,
                        results[i].al,
                    ]);
                }
                updatePurchaseIndex(plans);
            }
        });
    },

    /**
     * Count type of purchase made
     * @returns {Void} void function
     */
    count: function() {

        'use strict';

        var self = this;
        var creditList = M.affiliate.creditList.active.concat(M.affiliate.creditList.pending);
        var thisMonth = calculateCalendar('m');
        var proPlanIDMap = {};

        this.totalCount = creditList.length;
        this.monthCount = 0;
        this.countedData = {};

        const updatePurchaseIndex = (plans) => {

            plans.forEach((item) => {
                proPlanIDMap[item[0]] = item[1];
            });

            creditList.forEach((item) => {
                if (thisMonth.start <= item.gts && item.gts <= thisMonth.end) {
                    self.monthCount++;
                }

                const index = proPlanIDMap[item.si];
                if (item.b && index !== 101) {
                    self.countedData.b = ++self.countedData.b || 1;
                }
                else {
                    self.countedData[index] = ++self.countedData[index] || 1;
                }
            });

            $('.affiliate-total-pur', this.$purchaseChartBlock).text(this.totalCount);
            $('.charts-head .compare span', this.$purchaseChartBlock).text(this.monthCount);

            $('.list-item.prol .label', this.$purchaseChartBlock)
                .text(formatPercentage(this.countedData[4] / this.totalCount || 0));
            $('.list-item.prol .num', this.$purchaseChartBlock).text(this.countedData[4] || 0);
            $('.list-item.pro1 .label', this.$purchaseChartBlock)
                .text(formatPercentage(this.countedData[1] / this.totalCount || 0));
            $('.list-item.pro1 .num', this.$purchaseChartBlock).text(this.countedData[1] || 0);
            $('.list-item.pro2 .label', this.$purchaseChartBlock)
                .text(formatPercentage(this.countedData[2] / this.totalCount || 0));
            $('.list-item.pro2 .num', this.$purchaseChartBlock).text(this.countedData[2] || 0);
            $('.list-item.pro3 .label', this.$purchaseChartBlock)
                .text(formatPercentage(this.countedData[3] / this.totalCount || 0));
            $('.list-item.pro3 .num', this.$purchaseChartBlock).text(this.countedData[3] || 0);
            $('.list-item.pro101 .label', this.$purchaseChartBlock)
                .text(formatPercentage(this.countedData[101] / this.totalCount || 0));
            $('.list-item.pro101 .num', this.$purchaseChartBlock).text(this.countedData[101] || 0);
            $('.list-item.business .label', this.$purchaseChartBlock)
                .text(formatPercentage(this.countedData.b / this.totalCount || 0));
            $('.list-item.business .num', this.$purchaseChartBlock).text(this.countedData.b || 0);

            affiliateUI.purchaseIndex.drawChart();
        };

        // Needs to use a version of the membership plans that includes the pro-lite plan
        affiliateUI.purchaseIndex.getPlans(updatePurchaseIndex);
    },

    /**
     * Let draw chart with given data.
     * @returns {Void} void function
     */
    drawChart: function() {

        'use strict';

        if (this.chart) {
            this.chart.destroy();
        }

        var $chartWrapper = $('.mega-data-box.purchase', affiliateUI.$body);
        var $ctx = $('#purchase-chart', $chartWrapper);

        this.chart = new Chart($ctx[0], {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [
                        this.countedData[4],
                        this.countedData[1],
                        this.countedData[2],
                        this.countedData[3],
                        this.countedData[101],
                        this.countedData.b,
                        $.isEmptyObject(this.countedData) ? 1  : 0
                    ],
                    backgroundColor: [
                        $ctx.css('--label-yellow'),
                        $ctx.css('--label-orange'),
                        $ctx.css('--label-red'),
                        $ctx.css('--label-purple'),
                        $ctx.css('--label-blue'),
                        $ctx.css('--label-green'),
                        $ctx.css('--surface-grey-2')
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                events: [],
                legend: {
                    display: false
                },
                cutoutPercentage: 74
            }
        });
    },
};

/**
 * Geographic distribution
 */
affiliateUI.geographicDistribution = {

    init: function() {

        'use strict';

        this.$geoDistBlock = $('.distribution', affiliateUI.$body);
        this.bindEvents();
        this.count();
        this.drawTable();
    },

    bindEvents: function() {

        'use strict';

        var self = this;

        $('.distribution-head .tab-button', this.$geoDistBlock).rebind('click.geoDist', function() {

            var $this = $(this);

            $('.tab-button', self.$geoDistBlock).removeClass('active');
            $('.chart-body', self.$geoDistBlock).addClass('hidden');

            $this.addClass('active');
            $('.chart-body.' + $(this).data('table'), self.$geoDistBlock).removeClass('hidden');
        });
    },

    /**
     * Count how many registration/puchases are made on each country
     * @returns {Void} void function
     */
    count: function() {

        'use strict';

        var self = this;
        this.signupGeo = {};

        M.affiliate.signupList.forEach(function(item) {
            self.signupGeo[item.cc] = ++self.signupGeo[item.cc] || 1;
        });

        this.creditGeo = {};

        var creditList = M.affiliate.creditList.active.concat(M.affiliate.creditList.pending);

        creditList.forEach(function(item) {
            self.creditGeo[item.cc] = ++self.creditGeo[item.cc] || 1;
        });
    },

    /**
     * Let's draw table with give data
     * @returns {Void} void function
     */
    drawTable: function() {

        'use strict';

        var self = this;

        var template =
            '<div class="fm-affiliate list-item">' +
                '<div class="img-wrap"><img src="$countryImg" alt=""></div>' +
                '<span class="name">$countryName</span><span class="num">$count</span>' +
            '</div>';

        var _sortFunc = function(a, b) {
            return self.signupGeo[b] - self.signupGeo[a];
        };
        var orderedSignupGeoKeys = Object.keys(this.signupGeo).sort(_sortFunc);
        var orderedCreditGeoKeys = Object.keys(this.creditGeo).sort(_sortFunc);
        var html = '';
        var countList = this.signupGeo;

        var _htmlFunc = function(item) {
            var country = countrydetails(item);
            html += template.replace('$countryImg', staticpath + 'images/flags/' + country.icon)
                .replace('$countryName', country.name || 'Unknown').replace('$count', countList[item]);
        };

        orderedSignupGeoKeys.forEach(_htmlFunc);

        if (html) {
            $('.geo-dist-reg .list', this.$geoDistBlock).safeHTML(html);
        }
        else {
            $('.geo-dist-reg .list', this.$geoDistBlock).empty();
        }

        html = '';
        countList = this.creditGeo;

        orderedCreditGeoKeys.forEach(_htmlFunc);

        if (html) {
            $('.geo-dist-pur .list', this.$geoDistBlock).safeHTML(html);
        }
        else {
            $('.geo-dist-pur .list', this.$geoDistBlock).empty();
        }
    }
};

/*
 * Dashboard End
 */

/** Scripting for VPN-related tasks. */
class VpnCredsManager {
    logIt() {
        console.log('Non-static member.'); // Jenkins
    }

    static getLocations() {

        return api.req({a: 'vpnr'})
            .then(({result}) => {
                assert(Array.isArray(result));

                return result;
            })
            .catch((ex) => {
                console.error('[VPN Manager] Unexpected error from API when fetching locations.', ex);
            });
    }

    static getActiveCredentials() {

        return api.req({a: 'vpng'})
            .then(({result}) => {
                assert(typeof result === 'object');

                return result;
            })
            .catch((ex) => {
                if (ex === ENOENT) {
                    return ex;
                }

                console.error('[VPN Manager] Unexpected error from API when fetching active credentials.', ex);
            });
    }

    static async createCredential() {
        const keypair = nacl.box.keyPair();

        return api.req({a: 'vpnp', k: ab_to_base64(keypair.publicKey)})
            .then(({result}) => {
                assert(typeof result === 'object');

                const cred = {
                    credNum: result[0],
                    vpnSubclusterId: result[1],
                    interfaceV4Address: result[2],
                    interfaceV6Address: result[3],
                    peerPublicKey: result[4],
                    locations: result[5],
                    keypair: keypair,
                };

                return cred;
            })
            .catch((ex) => {
                if (ex === EACCESS) {
                    console.warn('[VPN Manager] You are not authorised to create VPN credentials. '
                        + 'Upgrade to Pro, then try again.');
                    return ex;
                }
                if (ex === ETOOMANY) {
                    console.warn('[VPN Manager] You have exceeded your credential limit. '
                        + 'Please deactivate one credential, then try again.');
                    return ex;
                }

                console.error('[VPN Manager] Unexpected error from API when creating a credential.', ex);
            });
    }

    static deactivateCredential(slotNum) {

        return api.req({a: 'vpnd', s: slotNum})
            .then(({result}) => {
                assert(result === 0);

                return result;
            })
            .catch((ex) => {
                console.error('[VPN Manager] Unexpected error from API when deactivating a credential.', ex);
            });
    }

    static generateIniConfig(cred, locationIndex = 0) {
        // assemble endpoint
        let endpoint = `${cred.locations[locationIndex]}.vpn`;
        if (cred.vpnSubclusterId > 1) {
            endpoint += cred.vpnSubclusterId;
        }
        endpoint += '.mega.nz:51820';

        let config = '[Interface]\n';
        config += `PrivateKey = ${btoa(ab_to_str(cred.keypair.secretKey))}\n`;
        config += `Address = ${cred.interfaceV4Address}/32, ${cred.interfaceV6Address}/128\n`;
        config += 'DNS = 8.8.8.8, 2001:4860:4860::8888\n\n';
        config += '[Peer]\n';
        config += `PublicKey = ${btoa(base64urldecode(cred.peerPublicKey))}\n`;
        config += 'AllowedIPs = 0.0.0.0/0, ::/0\n';
        config += `Endpoint = ${endpoint}\n`;

        return config;
    }
}

class GalleryTitleControl extends MComponent {
    buildElement() {
        this.el = document.createElement('div');
        this.el.setAttribute('class', 'flex flex-row items-center text-ellipsis');

        this.attachIcon();
        this.attachTitle();
    }

    get filterSection() {
        return this._filterSection || '';
    }

    get locationPrefKey() {
        return `web.locationPref.${this.filterSection}`;
    }

    /**
     * Set the filter section
     * @param {String} section Gallery section to filter
     * @type {String}
     */
    set filterSection(section) {
        if (!mega.gallery.sections[section]) {
            return;
        }

        this.isClickable = section !== 'favourites';

        section = mega.gallery.sections[section].root;

        if (this.isClickable) {
            this._filterSection = section;
            this.initMenu();
            this.resetItemOptions();
        }
    }

    get title() {
        return this._title || '';
    }

    /**
     * @param {String} title Title of the block
     */
    set title(title) {
        if (this._title !== title) {
            this._title = title;
            this.titleEl.textContent = title;
        }
    }

    get icon() {
        return this._icon || '';
    }

    /**
     * @param {String} icon Icon prepending the title
     */
    set icon(icon) {
        if (this._icon !== icon) {
            this._icon = icon;
            this.iconEl.setAttribute('class', 'sprite-fm-mono icon-' + icon);
        }
    }

    get isClickable() {
        return this._isClickable === true;
    }

    /**
     * @param {Boolean} status Whether control is clickable at the moment or not
     */
    set isClickable(status) {
        this._isClickable = status;

        if (status) {
            this.el.classList.add('cursor-pointer');
            this.attachCaret();

            this.attachEvent('click', () => {
                this.toggleMenu();
            });
        }
        else {
            this.el.classList.remove('cursor-pointer');
            this.detachCaret();
            this.disposeEvent('click');
        }
    }

    /**
     * @type {String}
     */
    get allItemsTitle() {
        return l.gallery_all_locations;
    }

    /**
     * @type {String}
     */
    get cuFolder() {
        return 'camera-uploads-' + this._filterSection;
    }

    /**
     * @type {String}
     */
    get cdFolder() {
        return 'cloud-drive-' + this._filterSection;
    }

    /**
     * @param {String} location Location preference to push to API
     * @returns {void}
     */
    pushNewLocationPreference(location) {
        if (this.rootBtn) {
            this.rootBtn.dataset.locationPref = location;
        }

        if (this.filterSection === 'photos') {
            const galleryBtn = document.querySelector('.nw-fm-left-icon.gallery');

            if (galleryBtn) {
                galleryBtn.dataset.locationPref = location;
            }
        }

        mega.gallery.prefs.init().then(({ setItem }) => {
            setItem(this.locationPrefKey, location);
        });
    }

    clearLocationPreference() {
        if (this.rootBtn && this.rootBtn.dataset.locationPref) {
            delete this.rootBtn.dataset.locationPref;
        }

        mega.gallery.prefs.init().then(({ removeItem }) => {
            removeItem(this.locationPrefKey);
        });
    }

    /**
     * @param {String} location Location to open
     * @returns {void}
     */
    openLocationFolder(location) {
        if (this.rootBtn && this.rootBtn.dataset.locationPref) {
            tryCatch(
                () => {
                    this.pushNewLocationPreference(location);
                },
                () => {
                    console.warn('Cannot set the preference for the location');
                }
            )();
        }

        this._menu.ignorePageNavigationOnce = true;
        M.openFolder(location, true);
    }

    attachTitle() {
        this.titleEl = document.createElement('span');
        this.el.append(this.titleEl);
    }

    addTooltipToTitle() {
        if (this.titleEl) {
            this.titleEl.classList.add('text-ellipsis', 'simpletip', 'simpletip-tc');
        }
    }

    removeTooltipFromTitle() {
        if (this.titleEl) {
            this.titleEl.classList.remove('text-ellipsis', 'simpletip', 'simpletip-tc');
        }
    }

    attachIcon() {
        this.iconEl = document.createElement('i');
        this.el.append(this.iconEl);
    }

    attachCaret() {
        if (this._caret) {
            return;
        }

        this._caret = document.createElement('span');
        this._caret.classList.add('nw-fm-tree-arrow', 'rot-90', 'ml-1');
        this.el.append(this._caret);
    }

    detachCaret() {
        if (this._caret) {
            this.el.removeChild(this._caret);
            delete this._caret;
        }
    }

    resetItemOptions() {
        this.rootBtn = document.querySelector(`.js-lp-gallery .btn-galleries[data-link=${this.filterSection}]`);

        this._menu.options = [
            {
                label: l.show_items_from
            },
            {
                label: this.allItemsTitle,
                click: () => {
                    this.openLocationFolder(this._filterSection);
                },
                selectable: true,
                selected: M.currentdirid === this._filterSection
            },
            {
                label: l.gallery_from_cloud_drive,
                click: () => {
                    this.openLocationFolder(this.cdFolder);
                },
                selectable: true,
                selected: M.currentdirid === this.cdFolder
            },
            {
                label: l.gallery_camera_uploads,
                click: () => {
                    this.openLocationFolder(this.cuFolder);
                },
                selectable: true,
                selected: M.currentdirid === this.cuFolder
            },
            {
                label: () => {
                    const label = document.createElement('div');
                    label.className = 'flex-1 flex flex-row items-center remember-location-pref';

                    const span = document.createElement('span');
                    span.className = 'flex-1';
                    span.textContent = l.gallery_remember_location_pref;

                    const checkbox = new MCheckbox({
                        name: 'remember_location_pref',
                        id: 'remember-location-pref',
                        checked: false,
                        passive: true
                    });

                    mega.gallery.prefs.init().then(({ getItem }) => {
                        const location = getItem(this.locationPrefKey);
                        checkbox.checked = typeof(location || null) === 'string';
                    });

                    const onChange = (status) => {
                        checkbox.disabled = true;

                        tryCatch(
                            () => {
                                if (status) {
                                    this.pushNewLocationPreference(M.currentdirid);
                                }
                                else {
                                    this.clearLocationPreference();
                                }

                                checkbox.disabled = false;
                                checkbox.checked = status;
                            },
                            () => {
                                console.warn('Could not update location preference...');
                            }
                        )();
                    };

                    span.onclick = () => {
                        onChange(!checkbox.checked);
                    };

                    checkbox.onChange = (status) => {
                        onChange(status);
                    };

                    label.appendChild(span);
                    label.appendChild(checkbox.el);
                    return label;
                },
                additionalClasses: 'px-6'
            }
        ];
    }

    initMenu() {
        if (!this._menu) {
            this._menu = new MMenuSelect(this.el, ['item-bold'], false);
            this._menu.width = 200;
        }
    }

    toggleMenu() {
        this.initMenu();
        this._menu.toggle();
    }

    hide() {
        if (this._menu) {
            this._menu.hide();
        }
    }
}

class GalleryEmptyBlock {
    constructor(parent) {
        if (typeof parent === 'string') {
            parent = document.querySelector(parent);
        }

        this.el = document.createElement('div');

        if (parent) {
            parent.append(this.el);
        }
    }

    /**
     * @param {String} type Section type for showing as empty
     */
    set type(type) {
        this._type = type;
        this.el.setAttribute('class', 'fm-empty-section fm-empty-' + type);
    }

    show() {
        this.removeChild();

        switch (this._type) {
            case mega.gallery.sections.photos.path:
            case mega.gallery.sections[mega.gallery.secKeys.cuphotos].path:
            case mega.gallery.sections[mega.gallery.secKeys.cdphotos].path:
                this._child = new GalleryEmptyPhotos(this.el);
                break;
            case mega.gallery.sections.images.path:
            case mega.gallery.sections[mega.gallery.secKeys.cuimages].path:
            case mega.gallery.sections[mega.gallery.secKeys.cdimages].path:
                this._child = new GalleryEmptyImages(this.el);
                break;
            case mega.gallery.sections.videos.path:
            case mega.gallery.sections[mega.gallery.secKeys.cuvideos].path:
            case mega.gallery.sections[mega.gallery.secKeys.cdvideos].path:
                this._child = new GalleryEmptyVideos(this.el);
                break;
            case mega.gallery.sections.favourites.path:
                this._child = new GalleryEmptyFavourites(this.el);
                break;
            default:
                if (M.currentrootid === 'discovery' || M.gallery) {
                    this._child = new GalleryEmptyDiscovery(this.el);
                }
                break;
        }
    }

    removeChild() {
        if (this._child) {
            this._child.remove();
            delete this._child;
        }
    }

    hide() {
        this.removeChild();
        this.el.removeAttribute('class');
    }
}

class GalleryEmptyPhotos extends MEmptyPad {
    constructor(parent) {
        super(parent);
        this.setContents();
    }

    setContents() {
        this.el.append(MEmptyPad.createIcon('section-icon sprite-fm-theme icon-gallery-photos'));
        this.el.append(MEmptyPad.createTxt(l.gallery_no_photos, 'fm-empty-cloud-txt'));
        this.el.append(MEmptyPad.createTxt(l.gallery_get_start, 'fm-empty-description'));

        this.appendOptions([
            [l.gallery_get_start_instruction_1, 'sprite-fm-mono icon-camera-uploads'],
            [l.gallery_get_start_instruction_2, 'sprite-fm-mono icon-mobile'],
            [l.gallery_get_start_instruction_3, 'sprite-fm-mono icon-pc']
        ]);
    }
}

class GalleryEmptyImages extends MEmptyPad {
    constructor(parent) {
        super(parent);
        this.setContents();
    }

    setContents() {
        this.el.append(MEmptyPad.createIcon('section-icon sprite-fm-theme icon-gallery-photos'));
        this.el.append(MEmptyPad.createTxt(l.gallery_no_images, 'fm-empty-cloud-txt'));
        this.el.append(MEmptyPad.createTxt(l.gallery_get_start, 'fm-empty-description'));

        this.appendOptions([
            [l.gallery_get_start_instruction_1, 'sprite-fm-mono icon-camera-uploads'],
            [l.gallery_get_start_instruction_2, 'sprite-fm-mono icon-mobile'],
            [l.gallery_get_start_instruction_3, 'sprite-fm-mono icon-pc']
        ]);
    }
}

class GalleryEmptyVideos extends MEmptyPad {
    constructor(parent) {
        super(parent);
        this.setContents();
    }

    setContents() {
        this.el.append(MEmptyPad.createIcon('section-icon sprite-fm-theme icon-gallery-videos'));
        this.el.append(MEmptyPad.createTxt(l.gallery_no_videos, 'fm-empty-cloud-txt'));
        this.el.append(MEmptyPad.createTxt(l.gallery_get_start, 'fm-empty-description'));

        this.appendOptions([
            [l.gallery_get_start_instruction_1, 'sprite-fm-mono icon-camera-uploads'],
            [l.gallery_get_start_instruction_2, 'sprite-fm-mono icon-mobile'],
            [l.gallery_get_start_instruction_3, 'sprite-fm-mono icon-pc']
        ]);
    }
}

class GalleryEmptyFavourites extends MEmptyPad {
    constructor(parent) {
        super(parent);
        this.setContents();
    }

    setContents() {
        this.el.append(MEmptyPad.createIcon('section-icon sprite-fm-theme icon-empty-state-favourite'));
        this.el.append(MEmptyPad.createTxt(l.gallery_favourites_empty, 'fm-empty-cloud-txt'));
    }
}

class GalleryEmptyDiscovery extends MEmptyPad {
    constructor(parent) {
        super(parent);
        this.setContents();
    }

    setContents() {
        this.el.append(MEmptyPad.createIcon('section-icon sprite-fm-theme icon-gallery-photos'));
        this.el.append(MEmptyPad.createTxt(l.gallery_no_photos, 'fm-empty-cloud-txt empty-md-title'));
        this.el.append(MEmptyPad.createTxt(l.md_empty_descr, 'fm-empty-description empty-md-description'));
    }
}

class GalleryNodeBlock {
    constructor(node) {
        this.node = node;
        this.el = document.createElement('a');
        this.el.className = 'data-block-view';
        this.el.id = node.h;

        this.spanEl = document.createElement('span');
        this.spanEl.className = 'data-block-bg content-visibility-auto';
        this.el.appendChild(this.spanEl);

        this.el.nodeBlock = this;
        this.isRendered = false;

        this.isVideo = mega.gallery.isVideo(this.node);
    }

    setThumb(dataUrl) {
        this.spanEl.classList.add('thumb');
        this.thumb.src = dataUrl;

        if (this.el.nextSibling && this.el.nextSibling.classList.contains('gallery-block-bg-wrap')) {
            this.el.nextSibling.querySelector('img').src = dataUrl;
        }

        mega.gallery.unsetShimmering(this.el);

        if (this.thumb) {
            this.thumb.classList.remove('w-full');
        }
    }

    fill(mode) {
        this.el.setAttribute('title', this.node.name);

        const spanMedia = document.createElement('span');
        this.spanEl.appendChild(spanMedia);
        spanMedia.className = 'item-type-icon-90';
        this.thumb = document.createElement('img');
        spanMedia.appendChild(this.thumb);

        if (this.isVideo) {
            spanMedia.classList.add('icon-video-90');
            this.spanEl.classList.add('video');

            const div = document.createElement('div');
            div.className = 'video-thumb-details';
            this.spanEl.appendChild(div);

            const spanTime = document.createElement('span');
            spanTime.textContent = secondsToTimeShort(MediaAttribute(this.node).data.playtime);
            div.appendChild(spanTime);
        }
        else {
            spanMedia.classList.add('icon-image-90');
        }

        const spanFav = document.createElement('span');
        spanFav.className = 'data-block-fav-icon sprite-fm-mono icon-favourite-filled';
        this.spanEl.appendChild(spanFav);

        if (mode === 'm' || mode === 'y') {
            this.el.dataset.ts = this.node.mtime || this.node.ts;
            this.el.dataset.date = GalleryNodeBlock.getTimeString(
                this.node.mtime || this.node.ts,
                mode === 'y' ? 14 : 15
            );
        }

        this.isRendered = true;
    }
}

GalleryNodeBlock.dateKeyCache = Object.create(null);
GalleryNodeBlock.maxGroupChunkSize = 60; // Max number of nodes per chunk
GalleryNodeBlock.thumbCacheSize = 500; // Number of images per cache at any given point
GalleryNodeBlock.allowsTransparent = { WEBP: 1, PNG: 1, GIF: 1 }; // Ideally, sync it with js/mega.js

GalleryNodeBlock.revokeThumb = (h) => {
    'use strict';

    if (!GalleryNodeBlock.thumbCache) {
        return;
    }

    const keys = Object.keys(GalleryNodeBlock.thumbCache);

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        if (M.d[h] && M.d[h].fa && key.startsWith(M.d[h].fa)) {
            URL.revokeObjectURL(GalleryNodeBlock.thumbCache[key]);
            delete GalleryNodeBlock.thumbCache[key];
        }
    }
};

GalleryNodeBlock.getTimeString = (key, format) => {
    'use strict';

    const cacheKey = `${key}-${format}`;

    if (!GalleryNodeBlock.dateKeyCache[cacheKey]) {
        GalleryNodeBlock.dateKeyCache[cacheKey] = time2date(key, format);
    }

    return GalleryNodeBlock.dateKeyCache[cacheKey];
};

class MegaGallery {
    constructor(id) {
        this.id = id || M.currentdirid;
        this.isDiscovery = !!id;
        this.groups = {y: {}, m: {}, d: {}, a: {}};
        this.scrollPosCache = {y: 0, m: 0, d: 0, a: 0};
        this.lastAddedKeys = {};
        this.galleryBlock = document.getElementById('gallery-view');
        this.contentRowTemplateNode = document.getElementById('gallery-cr-template');
        this.updNode = Object.create(null);
        this.type = mega.gallery.sections[id] ? 'basic' : 'discovery';
        this.shouldProcessScroll = true;
        this.inPreview = false;

        this.clearRenderCache();
        this.setObserver();
    }

    get onpage() {
        return this.id === M.currentCustomView.nodeID || (M.gallery && M.currentrootid === M.RootID);
    }

    mainViewNodeMapper(h) {
        const n = M.d[h] || this.updNode[h] || false;

        console.assert(!!n, `Node ${h} not found...`);
        return n;
    }

    setObserver() {
        this.nodeBlockObserver = typeof IntersectionObserver === 'undefined'
            ? null
            : new IntersectionObserver(
                (entries) => MegaGallery.handleIntersect(entries, this),
                {
                    root: this.galleryBlock,
                    rootMargin: '1000px',
                    threshold: 0.1
                }
            );

        this.blockSizeObserver = typeof ResizeObserver === 'undefined'
            ? null
            : new ResizeObserver((entries) => MegaGallery.handleResize(entries));
    }

    dropDynamicList() {
        if (this.dynamicList) {
            this.dynamicList.destroy();
            this.dynamicList = false;
        }
    }

    clearRenderCache(key) {
        if (key) {
            if (this.renderCache[key]) {
                delete this.renderCache[key];
            }
        }
        else {
            this.renderCache = Object.create(null);
            MegaGallery.revokeThumbs();
        }
    }

    static sortViewNodes() {
        const sortFn = M.sortByModTimeFn2();
        M.v.sort((a, b) => sortFn(a, b, -1));
    }

    static getCameraHandles() {
        if (!M.CameraId) {
            return [];
        }

        const cameraTree = M.getTreeHandles(M.CameraId);

        if (M.SecondCameraId) {
            cameraTree.push(...M.getTreeHandles(M.SecondCameraId));
        }

        return cameraTree;
    }

    setMode(type, pushHistory, changeRootMode) {

        if (type !== 'a' && type !== 'y' && type !== 'm' && type !== 'd') {

            console.error('MegaGallery: Entered mode is not valid, fallback to type `a`');

            return;
        }

        if (this.dynamicList) {
            this.throttledOnScroll();
        }

        this.mode = type;
        this.galleryBlock.classList.remove('gallery-type-a', 'gallery-type-y', 'gallery-type-m', 'gallery-type-d');
        this.galleryBlock.classList.add(`gallery-type-${type}`);

        if (changeRootMode === true
            && mega.gallery.sections[M.currentdirid]
            && mega.gallery.rootMode[mega.gallery.sections[M.currentdirid].root]
        ) {
            mega.gallery.rootMode[mega.gallery.sections[M.currentdirid].root] = this.mode;
        }

        if (type === 'a') {
            this.setZoom(this.zoom || 2);
        }
        else {
            delete this.zoom;
        }

        $('.gallery-tab-lnk').removeClass('active');
        $(`.gallery-tab-lnk-${this.mode}`).addClass('active');

        this.dropDynamicList();

        if (pfid) {
            pushHistoryState(true, Object.assign({}, history.state, {galleryMode: this.mode}));
        }
        else if (pushHistory === 2) {
            pushHistoryState(true, {subpage: page, galleryMode: this.mode});
        }
        else if (pushHistory === 1) {
            pushHistoryState(page, {galleryMode: this.mode});
        }
    }

    findMiddleImage() {
        const $blockViews = $(".MegaDynamicList .data-block-view", this.galleryBlock);
        const contentOffset = this.dynamicList.$content.offset();
        const listContainerHeight = this.dynamicList.$listContainer.height();

        let $middleBlock = null;
        let minDistance = 1e6;

        const scrollTop = this.dynamicList.getScrollTop();

        for (const v of $blockViews) {
            const $v = $(v);

            if ($v.offset().left < contentOffset.left + 5) {
                const {blockSize, blockTop} = this.getBlockTop($v.attr('id'));
                const middle = blockTop + blockSize / 2 - scrollTop;
                const distance = Math.abs(listContainerHeight / 2 - middle);

                if (distance < minDistance) {
                    minDistance = distance;
                    $middleBlock = $v;
                }
            }

        }

        return $middleBlock;
    }

    setZoom(type) {

        const min = 1;
        const max = 4;

        if (typeof type !== 'number' || type < min || type > max) {

            console.error('MegaGallery: None supporting zoom level provided.');

            return;
        }

        if (this.mode !== 'a') {

            console.error('MegaGallery: Zoom is only support on all view.');

            return;
        }

        this.zoom = type;

        for (let i = min; i < max + 1; i++) {
            this.galleryBlock.classList.remove(`zoom-${i}`);
        }

        this.galleryBlock.classList.add(`zoom-${type}`);

        const zoomInBtn = this.galleryBlock.querySelector('.zoom-in');
        const zoomOutBtn = this.galleryBlock.querySelector('.zoom-out');

        zoomInBtn.classList.remove('disabled');
        zoomOutBtn.classList.remove('disabled');

        if (this.zoom === min) {
            zoomInBtn.classList.add('disabled');
        }
        else if (this.zoom === max) {
            zoomOutBtn.classList.add('disabled');
        }
    }

    setGroup(n) {
        const res = this.getGroup(n);

        this.setYearGroup(res[1], n.h);
        this.setMonthGroup(res[2], res[3]);
        this.setDayGroup(res[3], n.h);
        this.setAllGroup(res[2], n.h);

        return res;
    }

    getGroup(n) {
        const timestamp = n.mtime || n.ts || Date.now() / 1000;
        const time = new Date(timestamp * 1000);

        const year = time.getFullYear();
        const month = time.getMonth();
        const day = time.getDate();

        return [
            timestamp,
            parseInt(new Date(year, 0, 1) / 1000),
            parseInt(new Date(year, month, 1) / 1000),
            parseInt(new Date(year, month, day) / 1000),
        ];
    }

    setYearGroup(key, h) {

        this.groups.y[key] = this.groups.y[key] || {c: 0, n: []};
        this.groups.y[key].c++;

        if (this.groups.y[key].n.length < 1) {
            this.groups.y[key].n.push(h);
        }
    }

    // For mega dynamic list, every 2 years should be merged as 1 group.
    mergeYearGroup() {
        const yearKeys = Object.keys(this.groups.y);
        const newStructure = {};

        for (let i = yearKeys.length - 1; i > -1; i -= 2) {
            newStructure[yearKeys[i]] = {c: [this.groups.y[yearKeys[i]].c], n: [this.groups.y[yearKeys[i]].n[0]]};

            if (this.groups.y[yearKeys[i - 1]]) {

                newStructure[yearKeys[i]].sy = yearKeys[i - 1];
                newStructure[yearKeys[i]].c.push(this.groups.y[yearKeys[i - 1]].c);
                newStructure[yearKeys[i]].n.push(this.groups.y[yearKeys[i - 1]].n[0]);
            }
        }

        this.groups.y = newStructure;
    }

    splitYearGroup() {

        const yearGroups = Object.keys(this.groups.y);
        const splitedYearGroup = {};

        for (var i = yearGroups.length; i--;) {

            splitedYearGroup[yearGroups[i]] = {
                c: this.groups.y[yearGroups[i]].c[0],
                n: [this.groups.y[yearGroups[i]].n[0]]
            };

            if (this.groups.y[yearGroups[i]].sy) {

                splitedYearGroup[this.groups.y[yearGroups[i]].sy] = {
                    c: this.groups.y[yearGroups[i]].c[1],
                    n: [this.groups.y[yearGroups[i]].n[1]]
                };
            }
        }

        this.groups.y = splitedYearGroup;
    }

    addToYearGroup(n, ts) {
        const sts = `${ts}`;

        const group = this.groups.y[ts];

        // This is existing year in view, nice.
        if (group) {
            group.c[0]++;

            let timeDiff = this.nodes[n.h] - this.nodes[group.n[0]];

            // Falling back to names sorting, if times are the same
            if (!timeDiff) {
                const sortedArr = [n, M.d[group.n[0]]];
                sortedArr.sort(this.sortByMtime.bind(this));

                if (sortedArr[0].h !== group.n[0]) {
                    timeDiff = 1;
                }
            }

            if (timeDiff > 0) {
                group.n[0] = n.h;

                this.clearRenderCache(`y${ts}`);

                if (this.mode === 'y' && this.dynamicList) {
                    this.throttledListChange(sts);
                }
            }
        }
        else {
            // This is secondary year of existing year in the view, good.
            const groupKeys = Object.keys(this.groups.y);

            for (var i = groupKeys.length; i--;) {
                const stsGroup = this.groups.y[groupKeys[i]];

                if (stsGroup.sy === sts) {
                    stsGroup.c[1]++;

                    let timeDiff = this.nodes[n.h] - this.nodes[stsGroup.n[1]];

                    if (!timeDiff) {
                        const sortedArr = [n, M.d[stsGroup.n[1]]];
                        sortedArr.sort(this.sortByMtime.bind(this));

                        if (sortedArr[0].h !== stsGroup.n[0]) {
                            timeDiff = 1;
                        }
                    }

                    if (timeDiff > 0) {
                        stsGroup.n[1] = n.h;

                        this.clearRenderCache(`y${groupKeys[i]}`);

                        if (this.dynamicList && this.mode === 'y') {
                            this.throttledListChange(`${groupKeys[i]}`);
                        }
                    }

                    return;
                }
            }

            // Damn this is new year we need to build whole year view again as it requires to push year after this
            this.splitYearGroup();
            this.setYearGroup(ts, n.h);
            this.mergeYearGroup();

            if (this.onpage && this.mode === 'y') {
                this.resetAndRender();
            }
            else {
                for (let i = 0; i < groupKeys.length; i++) {
                    this.clearRenderCache(`y${groupKeys[i]}`);
                }
            }
        }
    }

    removeFromYearGroup(h, ts) {
        const sts = `${ts}`;
        let removeGroup = false;

        // This is existing year in view, nice.
        if (this.groups.y[ts]) {

            if (--this.groups.y[ts].c[0] === 0) {
                removeGroup = true;
            }
            else if (h === this.groups.y[ts].n[0]) {
                this.groups.y[ts].n[0] = this.findYearCover(ts);

                this.clearRenderCache(`y${ts}`);
                this.throttledListChange(sts);
            }
        }
        else {

            // This is probably secondary year of existing year in the view, let's check.
            const yearGroups = Object.keys(this.groups.y);

            for (var i = yearGroups.length; i--;) {

                if (parseInt(this.groups.y[yearGroups[i]].sy) === ts && --this.groups.y[yearGroups[i]].c[1] === 0) {
                    removeGroup = true;
                    break;
                }
                else if (h === this.groups.y[yearGroups[i]].n[1]) {
                    this.groups.y[yearGroups[i]].n[1] = this.findYearCover(ts);
                    this.clearRenderCache(`y${yearGroups[i]}`);
                    this.throttledListChange(yearGroups[i]);
                }
            }
        }

        // Damn this is delete an year from view we need to build year view again.
        if (removeGroup) {
            this.splitYearGroup();
            delete this.groups.y[ts];
            this.mergeYearGroup();

            if (this.onpage) {
                this.resetAndRender();
            }
        }
    }

    findYearCover(ts) {
        const keys = Object.keys(this.groups.a);
        const {start, end} = calculateCalendar('y', ts);
        let m = 0;
        let s = "";
        for (const k of keys) {
            const f = parseFloat(k);
            const n = Math.round(f);
            if (start <= n && n <= end && f > m) {
                m = f;
                s = k;
            }
        }

        if (this.groups.a[s] && this.groups.a[s].n.length > 0) {
            return this.groups.a[s].n[0];
        }

        return null;

    }

    rebuildDayGroup(ts) {
        delete this.groups.d[ts];
        delete this.groups.d[ts - 0.5];
        this.clearRenderCache(`d${ts}`);
        this.clearRenderCache(`d${ts - 0.5}`);

        const {start, end} = calculateCalendar('d', ts);
        const keys = Object.keys(this.nodes);
        for (const h of keys) {
            const n = M.d[h];

            if (!n) {
                continue;
            }

            const timestamp = n.mtime || n.ts;
            if (start <= timestamp && timestamp <= end) {
                const res = this.getGroup(n);
                this.setDayGroup(res[3], n.h);
            }
        }
    }

    rebuildMonthGroup(ts) {
        delete this.groups.m[ts];
        const {start, end} = calculateCalendar('m', ts);
        const keys = Object.keys(this.nodes);
        for (const h of keys) {
            const n = M.d[h];

            if (!n) {
                continue;
            }

            const timestamp = n.mtime || n.ts;
            if (start <= timestamp && timestamp <= end) {
                const res = this.getGroup(n);
                this.setMonthGroup(ts, res[3]);
            }
        }
        this.filterOneMonthGroup(ts);
    }

    setMonthGroup(key, dayTs) {

        this.groups.m[key] = this.groups.m[key] ||
            {
                l: GalleryNodeBlock.getTimeString(key, 3),
                ml: GalleryNodeBlock.getTimeString(key, 13),
                c: 0,
                n: [],
                dts: {},
                ldts: 0
            };
        this.groups.m[key].c++;
        this.groups.m[key].dts[dayTs] = 1;
        this.groups.m[key].ldts = Math.max(this.groups.m[key].ldts, dayTs);
    }

    filterOneMonthGroup(ts) {
        const dayKeys = Object.keys(this.groups.m[ts].dts);

        dayKeys.sort((a, b) => b - a);

        this.groups.m[ts].n = dayKeys.slice(0, 4).map(k => this.groups.d[k].n[0]);
        this.groups.m[ts].dts = {};
    }

    filterMonthGroup() {
        const monthKeys = Object.keys(this.groups.m).sort((a, b) => b - a);
        let triEvenCount = 0;

        for (let i = 0; i < monthKeys.length; i++) {
            const dayKeys = Object.keys(this.groups.m[monthKeys[i]].dts);

            dayKeys.sort((a, b) => b - a);

            const max = i % 3 === 2 ? 4 : 3;

            this.groups.m[monthKeys[i]].n = dayKeys.slice(0, 4).map(k => this.groups.d[k].n[0]);
            this.groups.m[monthKeys[i]].max = max;

            const count = Math.min(max, this.groups.m[monthKeys[i]].n.length);

            if (count === 3) {
                this.groups.m[monthKeys[i]].r = triEvenCount++ % 2 === 1;
            }
            else if (count === 1 && this.groups.d[dayKeys[0]].n.length > 1) {
                this.groups.m[monthKeys[i]].extn = this.groups.d[dayKeys[0]].n[1];
            }

            this.groups.m[monthKeys[i]].dts = {};
        }
    }

    updateMonthMaxAndOrder() {
        const monthKeys = Object.keys(this.groups.m).sort((a, b) => b - a);
        let triEvenCount = 0;

        for (let i = 0; i < monthKeys.length; i++) {

            const max = i % 3 === 2 ? 4 : 3;

            this.groups.m[monthKeys[i]].max = max;

            delete this.groups.m[monthKeys[i]].r;

            const count = Math.min(max, this.groups.m[monthKeys[i]].n.length);

            if (count === 3) {
                this.groups.m[monthKeys[i]].r = triEvenCount++ % 2 === 1;
            }
        }
    }

    // This function is rely on result from day group processing.
    // Therefore, day group has to be processed before execute this function.
    addToMonthGroup(n, ts, dts) {
        const group = this.groups.m[ts];
        const sts = `${ts}`;

        // This is a node for existing group
        if (group) {
            const compareGroup = clone(group);

            group.c++;

            let sameDayNode = false;
            let sameDayNodeIndex;

            for (var i = 0; i < group.n.length; i++) {

                if (calculateCalendar('d', this.nodes[group.n[i]]).start === dts) {
                    sameDayNode = group.n[i];
                    sameDayNodeIndex = i;
                    break;
                }
            }

            if (sameDayNode) {
                let timeDiff = this.nodes[n.h] > this.nodes[sameDayNode];

                if (!timeDiff) {
                    const sortedArr = [n, M.d[sameDayNode]];
                    sortedArr.sort(this.sortByMtime.bind(this));

                    if (sortedArr[0].h !== group.n[0]) {
                        timeDiff = 1;
                    }
                }

                if (timeDiff > 0) {
                    group.n.splice(sameDayNodeIndex, 1, n.h);
                }

                // This is only one day month
                if (group.n.length === 1 && this.groups.d[dts].n.length > 1) {
                    this.groups.d[dts].n.sort((a, b) => this.nodes[b] - this.nodes[a]);
                    group.extn = this.groups.d[dts].n[1];
                }
            }
            else {
                delete group.extn;

                group.n.push(n.h);
                group.n.sort((a, b) => this.nodes[b] - this.nodes[a]);
                group.n = group.n.slice(0, 4);
            }

            this.clearRenderCache(`m${ts}`);
            this.updateMonthMaxAndOrder();

            if (this.dynamicList && this.mode === 'm' && (group.extn !== compareGroup.extn ||
                !group.n.every(h => compareGroup.n.includes(h)))) {
                this.throttledListChange(sts);
            }
        }
        // This is a node for new group
        else {
            this.groups.m[ts] = {
                c: 1,
                dts: {},
                l: GalleryNodeBlock.getTimeString(ts, 3),
                ldts: dts,
                ml: GalleryNodeBlock.getTimeString(ts, 13),
                n: [n.h]
            };

            this.updateMonthMaxAndOrder();

            if (this.dynamicList && this.mode === 'm') {

                const mts = Object.keys(this.groups.m);

                mts.sort((a, b) => b - a);

                this.dynamicList.insert(mts[mts.indexOf(sts) - 1], sts, this.onpage);
            }
        }
    }

    // This function is rely on result from day group processing.
    // Therefore, day group has to be processed before execute this function.
    removeFromMonthGroup(h, ts, dts) {

        let group = this.groups.m[ts];

        if (!group) {
            return;
        }

        const compareGroup = clone(group);
        const sts = `${ts}`;

        const _setExtraNode = dts => {

            if (this.groups.d[dts] && this.groups.d[dts].n.length > 1) {

                group.extn = this.groups.d[dts].n[1];
                return group.extn;
            }
        };

        group.c--;

        // The node was last node for the group lets delete whole group
        if (group.c === 0) {

            delete this.groups.m[ts];

            this.updateMonthMaxAndOrder();
            this.clearRenderCache(`m${ts}`);

            if (this.mode === 'm' && this.dynamicList) {
                this.dynamicList.remove(sts, this.onpage);
            }

        }
        // The node is extra node for single day month block, lets remove extra node or update it.
        else if (group.extn === h) {

            if (!_setExtraNode(dts)) {
                delete group.extn;
            }
            this.clearRenderCache(`m${ts}`);
            this.throttledListChange(sts);
        }
        else {

            this.rebuildMonthGroup(ts);
            this.updateMonthMaxAndOrder();

            group = this.groups.m[ts];

            if (group.n.length === 1) {
                _setExtraNode(calculateCalendar('d', this.nodes[group.n[0]]).start);
            }

            if (group.extn !== compareGroup.extn ||
                !compareGroup.n.every(h => group.n.includes(h))) {
                this.clearRenderCache(`m${ts}`);
                this.throttledListChange(sts);
            }
        }
    }

    setDayGroup(key, h) {

        this.groups.d[key] = this.groups.d[key] || {l: GalleryNodeBlock.getTimeString(key, 2), c: 0, n: []};
        this.groups.d[key].c++;

        if (this.groups.d[key].c <= 5) {
            this.groups.d[key].n.push(h);
            this.groups.d[key].n.sort(this.sortByMtime.bind(this));

            if (this.groups.d[key].n.length === 5) {
                const itemsToMove = this.groups.d[key].n.splice(2, 3);
                this.groups.d[key - 0.5] = {l: '', c: 0, mc: 0,  n: [...itemsToMove]};
            }
        }
        else {
            this.groups.d[key - 0.5].mc++;
        }
    }

    addToDayGroup(n, ts) {

        // If the day block has more than 4 items, we do not need to update layout but possibly just change nodes list
        if (this.groups.d[ts] && this.groups.d[ts].c > 4) {

            const dayGroup1 = this.groups.d[ts];
            const dayGroup2 = this.groups.d[ts - 0.5];

            dayGroup1.c++;
            dayGroup2.mc++;

            const nodeGroup = [...dayGroup1.n, ...dayGroup2.n];
            const compareGroup = new Set([...dayGroup1.n, ...dayGroup2.n]);

            nodeGroup.push(n.h);
            nodeGroup.sort(this.sortByMtime.bind(this));
            nodeGroup.pop();

            // Ends up same group we do not need to update anything
            if (nodeGroup.every(node => compareGroup.has(node))) {
                return;
            }

            dayGroup1.n = nodeGroup.splice(0, 2);
            dayGroup2.n = nodeGroup;
        }
        // If the day block has less than 5 just run normal setDayGroup to update existing layout.
        else {
            this.setDayGroup(ts, n.h);
        }

        if (this.dynamicList && this.mode === 'd') {
            const sts1 = `${ts}`;
            const sts2 = `${ts - 0.5}`;

            if (this.groups.d[ts].c === 1) {

                const keys = Object.keys(this.groups.d).sort((a, b) => b - a);

                this.dynamicList.insert(keys[keys.indexOf(sts1) - 1], sts1, this.onpage);
            }
            else if (this.groups.d[ts].c === 5) {

                this.clearRenderCache(`d${ts - 0.5}`);
                this.clearRenderCache(`d${ts}`);

                this.throttledListChange(sts1);
                this.dynamicList.insert(sts1, sts2, this.onpage);
            }
            else if (this.groups.d[ts].c > 5) {

                this.clearRenderCache(`d${ts - 0.5}`);
                this.clearRenderCache(`d${ts}`);

                this.throttledListChange(sts1);
                this.throttledListChange(sts2);
            }
            else {
                this.clearRenderCache(`d${ts}`);
                this.throttledListChange(sts1);
            }
        }
        else {
            this.clearRenderCache(`d${ts}`);
        }
    }

    removeFromDayGroup(h, ts) {
        const stsArr = [`${ts}`, `${ts - 0.5}`]; // sts keys of groups to remove

        this.rebuildDayGroup(ts);

        for (let i = 0; i < stsArr.length; i++) {
            const sts = stsArr[i];

            if (this.groups.d[sts]) {
                this.throttledListChange(sts);
            }
            else if (this.mode === 'd' && this.dynamicList && this.dynamicList.items.includes(sts)) {
                this.dynamicList.remove(sts, this.onpage);
            }
        }
    }

    // lets Chunk block by 60 to optimise performance of dom rendering
    setGroupChunk(ts) {
        let key = '';
        let timeLabel = '';

        if (!this.lastAddedKeys[ts]) {
            key = ts.toFixed(5);
            this.lastAddedKeys[ts] = key;
            timeLabel = GalleryNodeBlock.getTimeString(ts, 3);
        }
        else if (this.groups.a[this.lastAddedKeys[ts]]
            && this.groups.a[this.lastAddedKeys[ts]].n.length >= GalleryNodeBlock.maxGroupChunkSize) {
            key = (parseFloat(this.lastAddedKeys[ts]) - 0.00001).toFixed(5);
            this.lastAddedKeys[ts] = key;
        }
        else {
            key = this.lastAddedKeys[ts];
        }

        if (!this.groups.a[key]) {
            this.groups.a[key] = {l: timeLabel, c: 0, n: []};
        }

        return key;
    }

    setAllGroup(ts, h) {
        // Keep this one first, as setGroupChunk creates an initial chunk as well
        const key = this.setGroupChunk(ts);

        this.groups.a[ts.toFixed(5)].c++;

        this.groups.a[key].n.push(h);
        return key;
    }


    flatTargetAllGroup(ts) {

        ts = ts.toFixed(5);

        // if there is no beginning group, no point to do heavy lifting
        if (!this.groups.a[ts]) {
            return [];
        }

        const nodes = [];
        const groupKeys = Object.keys(this.groups.a);

        groupKeys.sort().reverse();

        for (let i = 0; i < groupKeys.length; i++) {

            const ceiledKey = Math.ceil(groupKeys[i]).toFixed(5);

            if (ceiledKey === ts) {
                nodes.push(...this.groups.a[groupKeys[i]].n);

                delete this.groups.a[groupKeys[i]];
                this.clearRenderCache(`a${groupKeys[i]}`);
            }
            else if (ceiledKey < ts) {
                break;
            }
        }

        this.lastAddedKeys = {};

        return nodes;
    }

    addToAllGroup(n, ts) {
        const flatNodes = this.flatTargetAllGroup(ts);

        flatNodes.push(n.h);
        flatNodes.sort(this.sortByMtime.bind(this));

        // Even only single node added, it can cause multiple group updated
        const reGrouped = {};

        flatNodes.forEach(h => {
            reGrouped[this.setAllGroup(ts, h)] = 1;
        });

        let reGroupedCount = Object.keys(reGrouped).length;

        if (this.dynamicList && this.mode === 'a') {

            const {items} = this.dynamicList;

            for (let i = 0; i < items.length; i++) {

                if (reGrouped[items[i]]) {

                    delete reGrouped[items[i]];
                    reGroupedCount--;

                    if (this.onpage) {
                        this.clearRenderCache(`y${items[i]}`);
                        this.throttledListChange(items[i]);
                    }

                    if (!reGroupedCount) {
                        break;
                    }
                }
            }

            // Adding new group
            if (reGroupedCount) {

                // New group can only one at a time
                const leftover = Object.keys(reGrouped)[0];
                let after;

                // If there is no nodes or there is node but it is earlier ts than first node place node at beginning
                if (!items[0] || items[0] - leftover < 0) {
                    after = 0;
                }
                // Else find suitable place to place new group.
                else {
                    after = items.find((item, i) => (items[i + 1] || 0) - leftover < 0);
                }

                this.dynamicList.insert(after, leftover, this.onpage);
            }
        }
    }

    removeFromAllGroup(h, ts) {
        if (M.d[h] && M.d[h].fa) {
            GalleryNodeBlock.revokeThumb(h);
        }

        const flatNodes = this.flatTargetAllGroup(ts).filter(nh => nh !== h);

        const reGrouped = {};

        flatNodes.forEach(nh => {
            reGrouped[this.setAllGroup(ts, nh)] = 1;
        });

        if (this.dynamicList && this.mode === 'a') {

            if (flatNodes.length === 0) {
                this.dynamicList.remove(ts.toFixed(5), this.onpage);

                return;
            }

            let last;

            this.dynamicList.items.forEach(group => {

                if (reGrouped[group]) {

                    last = group;

                    if (this.onpage) {
                        this.throttledListChange(group);
                    }
                }
            });

            // Clear empty group if exist.
            const leftover = (last - 0.00001).toFixed(5);

            if (this.dynamicList.items.includes(leftover)) {
                this.dynamicList.remove(leftover, this.onpage);
            }
        }
    }

    async addNodeToGroups(n) {
        if (
            n.fv // Improper file version
            || this.updNode[n.h] // The node is being added from another place
        ) {
            return;
        }

        this.updNode[n.h] = n;

        const updatedGroup = this.getGroup(n);

        this.nodes[n.h] = updatedGroup[0];

        if (!M.d[n.h]) {
            await dbfetch.get(n.h);
        }

        if (!this.dynamicList && this.onpage) {
            this.initDynamicList();
            this.dynamicList.initialRender();
        }

        // Do not change order, some function here is rely on result from another
        // This order should be keep this way in order to process data in order.
        this.addToAllGroup(n, updatedGroup[2]);
        this.addToDayGroup(n, updatedGroup[3]);
        this.addToMonthGroup(n, updatedGroup[2], updatedGroup[3]);
        this.addToYearGroup(n, updatedGroup[1]);

        if (this.dynamicList && this.onpage) {
            mega.gallery.fillMainView(this);
        }

        MegaGallery.sortViewNodes();

        delete this.updNode[n.h];

        this.throttledResize();
    }

    removeNodeFromGroups(n) {
        if (!this.nodes[n.h]) {
            return; // The node has been removed already
        }

        const updatedGroup = this.getGroup(n);

        delete this.nodes[n.h];

        // Do not change order, some function here is rely on result from another
        // This order should be keep this way in order to process data in order.
        this.removeFromAllGroup(n.h, updatedGroup[2]);
        this.removeFromDayGroup(n.h, updatedGroup[3]);
        this.removeFromMonthGroup(n.h, updatedGroup[2], updatedGroup[3]);
        this.removeFromYearGroup(n.h, updatedGroup[1]);

        if (this.dynamicList && M.currentCustomView.original === this.id) {
            mega.gallery.fillMainView(this);
        }

        MegaGallery.sortViewNodes();

        if (this.dynamicList && M.v.length === 0) {
            this.dropDynamicList();
            this.galleryBlock.classList.add('hidden');

            mega.gallery.showEmpty(M.currentdirid);
        }
    }

    // Special operation for d action packet which may lost node data already when reaching here
    removeNodeByHandle(h) {
        if (!this.nodes[h]) {
            return;
        }

        if (M.d[h]) {
            this.removeNodeFromGroups(M.d[h]);
        }
        else {
            this.removeNodeFromGroups({ h, mtime: this.nodes[h] });
        }
    }

    // Update dom node names if changed
    updateNodeName(n) {

        const group = this.getGroup(n);
        const rcKeys = Object.keys(this.renderCache);

        for (let i = rcKeys.length; i--;) {

            if (rcKeys[i].startsWith(`y${group[1]}`) || rcKeys[i].startsWith(`m${group[2]}`) ||
                rcKeys[i].startsWith(`d${group[3]}`) || rcKeys[i].startsWith(`a${group[2]}`)) {

                const domNode = this.renderCache[rcKeys[i]].querySelector(`[id="${n.h}"]`);

                if (domNode && domNode.title !== n.name) {
                    domNode.title = n.name;
                }
            }
        }
    }

    initDynamicList() {
        const container = document.querySelector('.gallery-view-scrolling');
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        this.slideShowCloseLister = mBroadcaster.addListener('slideshow:close', () => {
            delay('galleryCloseSlideShow', () => {
                this.inPreview = false;
            });
        });

        $('.fm-right-files-block').removeClass('emptied');
        $(`.fm-empty-${this.isDiscovery ? 'discovery' : this.id}`).addClass('hidden');
        this.galleryBlock.classList.remove('hidden');

        if (this.mode === 'a') {
            this.galleryBlock.classList.add(`zoom-${this.zoom}`);
        }

        this.dynamicList = new MegaDynamicList(container, {
            'contentContainerClasses': 'content',
            'itemRenderFunction': this.renderGroup.bind(this),
            'itemHeightCallback': this.getGroupHeight.bind(this),
            'onResize': this.throttledResize.bind(this),
            'onScroll': this.throttledOnScroll.bind(this),
            'perfectScrollOptions': {
                'handlers': ['click-rail', 'drag-thumb', 'wheel', 'touch'],
                'minScrollbarLength': 20
            }
        });

        M.initShortcutsAndSelection(container);
    }

    render(rewriteModeByRoot, reset) {
        if (rewriteModeByRoot !== false && mega.gallery.sections[M.currentdirid]) {
            const modeResetIsNeeded = reset === true
                && M.currentdirid === mega.gallery.sections[M.currentdirid].root
                && (
                    M.currentdirid === M.previousdirid
                    ||
                        mega.gallery.sections[M.previousdirid]
                        && mega.gallery.sections[M.previousdirid].root === mega.gallery.sections[M.currentdirid].root

                );

            if (modeResetIsNeeded) {
                this.setMode('a', 2, true);
            }
            else if (mega.gallery.rootMode[mega.gallery.sections[M.currentdirid].root]
                && this.mode !== mega.gallery.rootMode[mega.gallery.sections[M.currentdirid].root]) {
                this.setMode(mega.gallery.rootMode[mega.gallery.sections[M.currentdirid].root], 2);
            }
        }

        const rfBlock = $('.fm-right-files-block', '.fmholder');
        const galleryHeader = $('.gallery-tabs-bl', rfBlock);

        galleryHeader.removeClass('hidden');
        $('.gallery-section-tabs', galleryHeader).toggleClass('hidden', M.currentdirid === 'favourites');
        rfBlock.removeClass('hidden');
        $('.files-grid-view.fm, .fm-blocks-view.fm, .fm-right-header, .fm-empty-section', rfBlock).addClass('hidden');
        $('.fm-files-view-icon').removeClass('active').filter('.media-view').addClass('active');

        if (pfid && !M.v) {
            $('.fm-empty-section', rfBlock).removeClass('hidden');
        }

        if (window.selectionManager) {
            window.selectionManager.hideSelectionBar();
        }

        if (!mega.gallery.viewBtns) {
            const viewBtns = $('.fm-header-buttons .view-links', rfBlock);
            mega.gallery.viewBtns = viewBtns.clone(true);
            galleryHeader.append(mega.gallery.viewBtns);
            $('.view-links', galleryHeader).toggleClass('hidden', M.isGalleryPage());
        }

        if (M.v.length > 0) {
            if (mega.gallery.emptyBlock) {
                mega.gallery.emptyBlock.hide();
            }

            this.initDynamicList();

            const keys = Object.keys(this.activeModeList).sort((a, b) => b - a);

            this.dynamicList.batchAdd(keys);
            this.dynamicList.initialRender();
            this.dynamicList.scrollToYPosition(this.scrollPosCache[this.mode].a);
        }
        else {
            mega.gallery.showEmpty(M.currentdirid);
            this.galleryBlock.classList.add('hidden');
        }
        tryCatch(() => {
            galleryHeader.toggleClass('invisible', !M.v.length &&
                (this.id === 'photos' || this.id === 'images' || this.id === 'videos'));
        })();
    }

    resetAndRender() {
        if (this.dynamicList && M.currentCustomView.original === this.id) {
            mega.gallery.fillMainView(this);
        }

        MegaGallery.sortViewNodes();

        this.clearRenderCache();
        this.dropDynamicList();

        this.render();
    }

    bindEvents() {

        const $galleryBlock = $(this.galleryBlock);

        $galleryBlock.rebind('click.galleryView', '.data-block-view', e => {

            const $eTarget = $(e.currentTarget);
            const h = $eTarget.attr('id');

            selectionManager.clear_selection();
            selectionManager.add_to_selection(h);

            $.hideContextMenu(e);

            // If the side Info panel is visible, update the information in it
            mega.ui.mInfoPanel.reRenderIfVisible($.selected);

            return false;
        });

        $galleryBlock.rebind('contextmenu.galleryView', '.data-block-view', e => {

            if (this.mode !== 'a') {
                return false;
            }

            $.hideContextMenu(e);
            selectionManager.resetTo(e.currentTarget.id);
            M.contextMenuUI(e, 1);
        });

        $galleryBlock.rebind('click.galleryView', '.gallery-date-block', e => {

            const $eTarget = $(e.currentTarget);
            let targetTs = $eTarget.parent().attr('id').replace('gallery-', '');

            targetTs = this.groups.m[targetTs].ldts;

            this.setMode('d', 1, true);
            this.render();

            onIdle(() => {
                this.dynamicList.scrollToItem(targetTs);
                this.throttledOnScroll();
            });

            return false;
        });

        $galleryBlock.rebind('click.galleryViewClear', () => {
            selectionManager.clear_selection();
        });

        $galleryBlock.rebind('dblclick.galleryView', '.data-block-view', e => {

            const $eTarget = $(e.currentTarget);

            if (this.mode === 'a') {
                const h = $eTarget.attr('id');
                const isVideo = e.currentTarget.nodeBlock.isVideo;

                if (isVideo) {
                    if (!isVideo.isVideo) {
                        M.addDownload([h]);
                        return;
                    }

                    $.autoplay = h;
                }

                // Close node Info panel as it's not applicable when opening Preview
                mega.ui.mInfoPanel.closeIfOpen();

                this.inPreview = true;
                slideshow(h, false);
            }
            else {
                let clickedDate = this.mode === 'd' ?
                    $eTarget.closest('.content-row').attr('id').replace('gallery-', '') : $eTarget.attr('data-ts');

                clickedDate = calculateCalendar(this.mode === 'm' ? 'd' : 'm', Math.ceil(clickedDate)).start;

                this.setMode(this.mode === 'd' ? 'a' : this.mode === 'm' ? 'd' : 'm', 1, true);
                this.render();

                onIdle(() => {

                    if (this.mode === 'a') {

                        const handle = e.currentTarget.id;

                        clickedDate = clickedDate.toFixed(5);

                        while (this.groups.a[clickedDate]) {

                            if (this.groups.a[clickedDate].n.includes(handle)) {
                                break;
                            }

                            clickedDate = (clickedDate - 0.00001).toFixed(5);
                        }

                        this.dynamicList.scrollToItem(clickedDate);

                        const scrollTarget = document.getElementById(e.currentTarget.id);

                        if (scrollTarget) {
                            const nodeOffset = this.dynamicList.listContainer.scrollTop + scrollTarget.offsetTop - 8;
                            this.dynamicList.scrollToYPosition(nodeOffset);
                        }
                    }
                    else {
                        this.dynamicList.scrollToItem(clickedDate);
                    }

                    this.throttledOnScroll();
                });
            }
        });

        $('.gallery-tab-lnk').rebind('click', e => {

            if (this.mode === e.currentTarget.attributes['data-folder'].value) {

                this.dynamicList.scrollToYPosition(0);
                this.throttledOnScroll();

                return false;
            }

            this.setMode(e.currentTarget.attributes['data-folder'].value, 1, true);
            this.render(false);
        });

        $('.gallery-view-zoom-control > button', this.galleryBlock).rebind('click.galleryZoom', e => {
            e.stopPropagation();
            $.hideContextMenu(e);

            if (!this.dynamicList) {
                // @todo dropDynamicList() shall $.off()..?
                return false;
            }

            this.$middleBlock = this.findMiddleImage();

            if (e.currentTarget.classList.contains('disabled')) {
                return false;
            }
            else if (e.currentTarget.classList.contains('zoom-in')) {
                this.setZoom(this.zoom - 1);
            }
            else if (e.currentTarget.classList.contains('zoom-out')) {
                this.setZoom(this.zoom + 1);
            }

            this.dynamicList.itemRenderChanged(false, true);

            if (this.$middleBlock) {
                const listContainerHeight = this.dynamicList.$listContainer.height();
                const {blockSize, blockTop} = this.getBlockTop(this.$middleBlock.attr('id'));
                this.shouldProcessScroll = false;
                this.dynamicList.scrollToYPosition(blockTop - (listContainerHeight - blockSize) / 2);
            }

            return false;

        });

        if (!this.beforePageChangeListener) {
            this.beforePageChangeListener = mBroadcaster.addListener('beforepagechange', tpage => {
                const pageId = String(self.page).replace('fm/', '');
                if (this.inPreview && (pageId.length < 5 ? M.RootID === M.currentdirid : pageId === M.currentdirid)) {
                    return;
                }

                this.dropDynamicList();

                // Clear render cache to free memory
                this.clearRenderCache();

                if (pfid && !tpage.startsWith('folder/')) {
                    $('.fm-files-view-icon.media-view').addClass('hidden');
                }

                const id = tpage.replace(/^fm\//, '');

                if (!mega.gallery.sections[id] && !id.startsWith('discovery/')) {
                    $('.gallery-tabs-bl', '.fm-right-files-block').addClass('hidden');
                }

                // Clear thumbnails to free memory if target page is not gallery anymore
                mBroadcaster.removeListener(this.beforePageChangeListener);
                delete this.beforePageChangeListener;

                // Clear discovery when it's not applicable anymore
                if (
                    this.isDiscovery
                    && (
                        !M.gallery
                        || pfid
                        || M.currentdirid !== tpage
                    )
                ) {
                    delete mega.gallery.discovery;

                    if (mega.gallery.reporter.runId) {
                        mega.gallery.reporter.stop();
                    }
                }

                if (this.workerBranch) {
                    webgl.worker.detach(this.workerBranch);
                    delete this.workerBranch;
                }

                $(window).unbind('keyup.exitDiscovery');
                if (this.slideShowCloseLister) {
                    mBroadcaster.removeListener(this.slideShowCloseLister);
                }
            });
        }

        $(window).rebind('popstate.galleryview', (ev) => {
            if (mega.gallery.titleControl) {
                mega.gallery.titleControl.hide();
            }

            if (!this.inPreview) {
                const { state = false } = ev.originalEvent || !1;

                if (state && state.galleryMode && this.onpage) {
                    this.setMode(state.galleryMode, undefined, true);
                    this.render(false);

                    this.inPreview = !!state.view;
                }
            }
        });

        if (!pfid && M.currentdirid.substr(0, 9) === 'discovery') {
            $('.gallery-close-discovery', '.gallery-tabs-bl')
                .removeClass('hidden')
                .rebind('click.exitDiscovery', () => {

                    M.openFolder(this.id).catch(dump);
                    return false;
                });

            $(window).rebind('keyup.exitDiscovery', e => {
                if (e.keyCode === 27 && !this.inPreview) { // ESC key pressed
                    M.openFolder(this.id);
                }
            });
        }
    }

    sortByMtime(ah, bh) {

        const a = M.d[ah] || this.updNode[ah];
        const b = M.d[bh] || this.updNode[bh];

        return M.sortByModTimeFn2()(a, b, -1);
    }

    renderGroup(id) {
        const cacheKey = this.mode + id;

        if (!this.renderCache[cacheKey]) {
            const group = this.getGroupById(id);

            const groupWrap = this.contentRowTemplateNode.cloneNode(true);
            const contentBlock = groupWrap.querySelector('.content-block');

            groupWrap.classList.remove('template');
            groupWrap.id = `gallery-${id}`;

            this.renderCache[cacheKey] = groupWrap;

            if (!group) {
                return this.renderCache[cacheKey];
            }

            if (this.mode !== 'm') {
                group.n.sort(this.sortByMtime.bind(this));

                if (group.l) {
                    groupWrap.classList.add('showDate');
                    contentBlock.dataset.date = group.l;
                }
            }

            let l = group.n.length;

            if (group.max) {
                l = Math.min(group.max, group.n.length);
            }

            for (let i = 0; i < l; i++) {

                const nodeElm = this.renderNode(group.n[i]);

                if (nodeElm) {
                    contentBlock.appendChild(nodeElm);
                }
            }

            if (group.extn) {

                const extraNode = this.renderNode(group.extn);

                if (extraNode) {

                    delete extraNode.dataset.date;
                    contentBlock.appendChild(extraNode);
                }
            }

            if (this.mode === 'd') {
                this.renderNodeExtraDay(group, groupWrap, contentBlock, l);
            }
            else if (this.mode === 'm') {
                this.renderNodeExtraMonth(group, groupWrap, contentBlock, l);
            }
        }

        this.clearSelection(id);

        return this.renderCache[cacheKey];
    }

    renderNodeExtraMonth(group, groupWrap, contentBlock, l) {

        const dateblock = document.createElement('a');

        dateblock.classList.add('gallery-date-block');

        // Special month corrective for Vietnamese.
        if (locale === 'vi') {
            group.ml = group.ml.toLowerCase();
        }

        $(dateblock).safeHTML(group.l.replace(group.ml, `<span>${group.ml}</span>`));

        const iconBlock = document.createElement('i');

        iconBlock.classList.add('sprite-fm-mono', 'icon-arrow-right');
        dateblock.appendChild(iconBlock);
        groupWrap.prepend(dateblock);

        if (group.r) {
            groupWrap.classList.add('layout-3-2');
        }
        else {
            groupWrap.classList.add(`layout-${l}`);
        }
    }

    renderNodeExtraDay(group, groupWrap, contentBlock, l) {

        // c is only numeric 0 when it is sub block
        if (group.c === 0) {
            groupWrap.classList.add('layout-3-2');
        }
        else {
            groupWrap.classList.add(`layout-${l}`);
        }

        if (group.mc) {

            groupWrap.classList.add('showMore');
            contentBlock.dataset.more = `+${group.mc}`;
        }

        if (group.n.length === 1) {

            const bgimg = document.createElement('img');
            const wrap = document.createElement('div');

            bgimg.classList.add('gallery-block-bg');
            wrap.classList.add('gallery-block-bg-wrap');

            wrap.appendChild(bgimg);
            contentBlock.appendChild(wrap);
        }
    }

    // Selection Removal for cache
    clearSelection(id) {

        if ($.selected.length) {

            const selectedInCache = this.renderCache[this.mode + id].getElementsByClassName('ui-selected');

            for (var i = selectedInCache.length; i--;) {

                if (selectedInCache[i].id !== $.selected[0]) {
                    selectedInCache[i].classList.remove('ui-selected');
                }
            }
        }
    }

    renderNode(h) {
        const node = M.d[h] || new MegaNode(this.updNode[h]);

        if (!node) {
            return;
        }

        const elm = new GalleryNodeBlock(node);

        mega.gallery.setShimmering(elm.el);

        if (this.nodeBlockObserver) {
            this.nodeBlockObserver.observe(elm.el, this);
        }
        else {
            elm.fill(this.mode);
            MegaGallery.addThumbnails([elm]);
        }

        return elm.el;
    }

    getBlockTop(id) {
        const keys = Object.keys(this.activeModeList).sort((a, b) => b - a);
        let height = 0;
        let blockSize = 0;
        for (const key of keys) {
            const group = this.getGroupById(key);
            const index = group.n.indexOf(id);
            if (index === -1) {
                height += this.getGroupHeight(key);
            }
            else {
                const maxItems = {1: 3, 2: 5, 3: 10, 4: 15};
                const maxItemsInRow = maxItems[this.zoom];
                blockSize = this.dynamicList.$content.width() / maxItemsInRow;
                height += Math.floor(index / maxItemsInRow) * blockSize;
                return {
                    blockSize: blockSize,
                    blockTop: height
                };
            }
        }
        return {
            blockSize: blockSize,
            blockTop: height
        };
    }

    getGroupHeight(id) {

        const wrapWidth = Math.max(Math.min(this.dynamicList.$content.width(), 820), 620);
        const group = this.getGroupById(id);

        if (this.mode === 'a') {

            const maxItems = {1: 3, 2: 5, 3: 10, 4: 15};
            const maxItemsInRow = maxItems[this.zoom];
            const blockSize = this.dynamicList.$content.width() / maxItemsInRow;

            return Math.ceil(group.n.length / maxItemsInRow) * blockSize;
        }
        else if (this.mode === 'd' || this.mode === 'y') {
            return wrapWidth / 2 + (this.mode === 'y' ? 16 : 0);
        }
        else if (this.mode === 'm') {

            let height;

            if (group.n.length <= 2) {
                height = (wrapWidth - 20) / 2;
            }
            else if (group.n.length === 3) {
                height = 380 / 620 * wrapWidth;
            }
            else {
                height = 420 / 620 * wrapWidth;
            }

            return height + 64;
        }
    }

    throttledResize() {
        delay('gallery.resizeListener', () => {
            if (this.dynamicList) {
                this.dynamicList.itemRenderChanged(false, true);
            }
        }, 100);
    }

    throttledOnScroll() {

        delay('gallery.onScroll', () => {
            if (!this.shouldProcessScroll) {
                this.shouldProcessScroll = true;
                return;
            }

            this.$middleBlock = null;

            if (this.dynamicList) {

                const actualScrollPos = this.dynamicList.getScrollTop();

                this.scrollPosCache[this.mode] = {
                    a: actualScrollPos,
                    s: actualScrollPos / this.dynamicList.$content.height()
                };
            }
        }, 100);
    }

    throttledListChange(gid) {
        delay(`gallery.listUpdate-${gid}`, () => {
            if (this.dynamicList) {
                this.dynamicList.itemChanged(gid);
            }
        }, 100);
    }

    setView() {
        const tempSubfolderMd = this.subfolderMd;
        this.subfolderMd = !mega.config.get('noSubfolderMd');

        if (this.nodes && this.subfolderMd === tempSubfolderMd) {

            mega.gallery.fillMainView(this);
            MegaGallery.sortViewNodes();

            return false;
        }

        if (d) {
            console.time(`MegaGallery: ${this.id}`);
        }

        M.v = [];
        this.nodes = {};
    }

    setViewAfter() {
        MegaGallery.sortViewNodes();
        mBroadcaster.sendMessage('mega:gallery:view:after');

        if (d) {
            console.timeEnd(`MegaGallery: ${this.id}`);
        }
    }

    get activeModeList() {
        return this.groups[this.mode];
    }

    getGroupById(id) {
        return this.activeModeList[id];
    }
}

class MegaTargetGallery extends MegaGallery {

    async setView() {
        if (super.setView() === false) {
            return false;
        }

        const handles = this.id === 'photos' ? MegaGallery.getCameraHandles()
            : this.subfolderMd ? M.getTreeHandles(this.id) : [this.id];
        let subs = [];

        if (self.fmdb) {
            await dbfetch.geta(handles).catch(nop);
        }

        for (let i = handles.length; i--;) {
            if (!M.c[handles[i]]) {
                if (self.d && !M.d[handles[i]]) {
                    console.error(`Gallery cannot find handle ${handles[i]}`);
                }
                continue;
            }

            subs = subs.concat(Object.keys(M.c[handles[i]]));
        }

        const rubTree = MegaGallery.handlesArrToObj(M.getTreeHandles(M.RubbishID));

        subs = subs.filter(h => {
            const n = M.d[h];
            return !n.t
                && !this.nodes[n.h]
                && !rubTree[h]
                && !rubTree[n.p]
                && !n.fv
                && mega.gallery.isGalleryNode(n);
        }).sort(this.sortByMtime.bind(this));

        for (const h of subs) {
            const n = M.d[h];
            this.nodes[n.h] = this.setGroup(n)[0];
            M.v.push(n);
        }

        this.mergeYearGroup();
        this.filterMonthGroup();

        super.setViewAfter();
    }

    checkGalleryUpdate(n) {
        if (!mega.gallery.isGalleryNode(n)) {
            return;
        }

        if (M.currentdirid === n.p && !M.v.length) {
            $(`.fm-empty-folder, .fm-empty-folder-link, .fm-empty-${M.currentdirid}`, '.fm-right-files-block')
                .addClass('hidden');
        }

        if (pfid) {
            delay(`pfid_discovery:node_update${n.h}`, () => {
                if (M.currentdirid === n.p) {
                    if (this.nodes[n.h]) {
                        this.updateNodeName(n);
                    }
                    else {
                        this.addNodeToGroups(n);
                    }
                }
                else if (this.nodes[n.h]) {
                    this.removeNodeFromGroups(n);
                }
            });

            return;
        }

        if (!n.t) {
            const cameraTree = M.getTreeHandles(this.isDiscovery ? this.id : M.CameraId);
            const rubTree = M.getTreeHandles(M.RubbishID);

            if (!this.isDiscovery && M.SecondCameraId) {
                cameraTree.push(...M.getTreeHandles(M.SecondCameraId));
            }

            const isInCameraTree = cameraTree.includes(n.p);

            // Checking if this item in rubbish bin
            if (M.getTreeHandles(M.RubbishID).includes(n.p)) {
                this.removeNodeFromGroups(n);
            }
            // If it is target Camera folder and it is not in gallery view now add the node to gallery.
            else if (isInCameraTree && !this.nodes[n.h]) {
                this.addNodeToGroups(n);
            }
            // Checking if this item in rubbish bin
            else if (cameraTree && rubTree.includes(n.p)) {
                this.removeNodeFromGroups(n);
            }
            // If it is not target Camera folder but it is in gallery view now remove the node from gallery view.
            else if (!isInCameraTree && this.nodes[n.h]) {
                this.removeNodeFromGroups(n);
            }
            // Lets check this is name update
            else if (this.onpage && this.renderCache && this.nodes[n.h]) {
                this.updateNodeName(n);
            }
        }
    }
}

class MegaMediaTypeGallery extends MegaGallery {

    typeFilter(n, cameraTree) {
        if (!mega.gallery.sections[this.id]) {
            return false;
        }

        return mega.gallery.sections[this.id].filterFn(n, cameraTree);
    }

    async setView() {

        if (super.setView() === false) {
            return false;
        }

        let nodes = [];
        const cameraTree = MegaGallery.getCameraHandles();
        const rubTree = MegaGallery.handlesArrToObj(M.getTreeHandles(M.RubbishID));

        if (MegaGallery.dbActionPassed) {
            nodes = Object.values(M.d).filter((n) =>
                n.fa
                && !rubTree[n.p]
                && n.s > 0
                && this.typeFilter(n, cameraTree)
            );
        }
        else {
            const handles = [];
            const dbNodes = await MegaGallery.dbAction()
                .catch(() => { // Fetching all available nodes in case of DB failure
                    console.warn('Local DB failed. Fetching existing FM nodes.');
                    return Object.values(M.d);
                });

            for (let i = 0; i < dbNodes.length; i++) {
                const n = dbNodes[i];

                if (!n.fa || !n.s || rubTree[n.p]) {
                    continue;
                }

                handles.push(n.p);

                if (this.typeFilter(n, cameraTree)) {
                    nodes.push(n);
                    this.updNode[n.h] = n;
                }
            }

            await dbfetch.geta(handles).catch(nop);

            MegaGallery.dbActionPassed = true;

            this.updNode = Object.create(null);

            // Initializing albums here for the performace's sake
            if (mega.gallery.albums.awaitingDbAction) {
                mega.gallery.albums.init();
            }
        }

        // This sort is needed for building groups, do not remove
        const sortFn = M.sortByModTimeFn2();
        nodes.sort((a, b) => sortFn(a, b, -1));

        if (!Array.isArray(nodes)) {
            if (d) {
                console.timeEnd(`MegaGallery: ${this.id}`);
            }

            return;
        }

        const sharesTree = M.getTreeHandles('shares');

        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];

            if (this.nodes[n.h] || n.t || sharesTree.includes(n.p) || this.id === 'favourites' && !n.fav) {
                continue;
            }

            if (!n.fv) {
                this.nodes[n.h] = this.setGroup(n)[0];
            }
        }

        mega.gallery.fillMainView(this);

        this.mergeYearGroup();
        this.filterMonthGroup();

        super.setViewAfter();
    }

    checkGalleryUpdate(n) {
        const cameraTree = MegaGallery.getCameraHandles();

        if (!n.t && this.typeFilter(n, cameraTree)) {
            const ignoreHandles = MegaGallery.handlesArrToObj([
                ...M.getTreeHandles('shares'),
                ...M.getTreeHandles(M.RubbishID)
            ]);
            let toGallery = !ignoreHandles[n.p];

            if (this.id === 'favourites') {
                toGallery = toGallery && n.fav;
            }

            // If it is target is rubbish bin or shared folder and it is in gallery view delete the node from it.
            if (!toGallery && this.nodes[n.h]) {

                // If changed node is what currently viewing on slideshow and it's fav flag is removed, moving backwards
                if (this.dynamicList && this.onpage && sessionStorage.previewNode === n.h) {

                    const backItem = slideshow_steps().backward[0];

                    onIdle(() => {
                        slideshow(backItem, !backItem);
                    });
                }

                this.removeNodeFromGroups(n);
            }
            // If it is not target other folders and it is not in gallery view add the node to it.
            else if (toGallery && !this.nodes[n.h]) {
                this.addNodeToGroups(n);
            }
            // Lets check this is name update
            else if (this.onpage && this.renderCache && this.nodes[n.h]) {
                this.updateNodeName(n);

                if (mega.gallery.pendingFaBlocks[n.h] && n.fa.includes(':1*')) {
                    MegaGallery.addThumbnails(Object.values(mega.gallery.pendingFaBlocks[n.h]));
                    delete mega.gallery.pendingFaBlocks[n.h];
                }
            }
        }
    }
}

mega.gallery = Object.create(null);
mega.gallery.nodeUpdated = false;
mega.gallery.albumsRendered = false;
mega.gallery.publicSet = Object.create(null);
mega.gallery.titleControl = null;
mega.gallery.emptyBlock = null;
mega.gallery.rootMode = {photos: 'a', images: 'a', videos: 'a'};
mega.gallery.pendingFaBlocks = {};
mega.gallery.pendingThumbBlocks = {};
mega.gallery.disallowedExtensions = { 'PSD': true, 'SVG': true };

/**
 * @TODO: Remove this check once we bump all browsers up to support this feature
 */
mega.gallery.hasWebAnimationsApi = typeof document.body.getAnimations === 'function';

Object.defineProperty(mega.gallery, 'albumsRendered', {
    get() {
        'use strict';
        return this._albumsRendered;
    },
    set(value) {
        'use strict';
        if (this._albumsRendered && value === false) {
            for (const id in this.albums.store) {
                const album = this.albums.store[id];

                if (album.cellEl) {
                    album.cellEl.dropBackground();
                }
            }
        }

        this._albumsRendered = value;
    }
});

mega.gallery.secKeys = {
    cuphotos: 'camera-uploads-photos',
    cdphotos: 'cloud-drive-photos',
    cuimages: 'camera-uploads-images',
    cdimages: 'cloud-drive-images',
    cuvideos: 'camera-uploads-videos',
    cdvideos: 'cloud-drive-videos'
};

mega.gallery.fillMainView = (list, mapper) => {
    'use strict';

    if (list instanceof MegaGallery) {
        mapper = list.mainViewNodeMapper.bind(list);
        list = Object.keys(list.nodes);
    }
    const {length} = list;

    if (mapper) {
        list = list.map(mapper);
    }
    M.v = list.filter(Boolean);

    console.assert(M.v.length === length, 'check this... filtered invalid entries.');
};

mega.gallery.handleNodeRemoval = (n) => {
    'use strict';

    if (M.isAlbumsPage()) {
        mega.gallery.albums.onCDNodeRemove(n);
        mega.gallery.nodeUpdated = true;
    }
    else if (M.gallery) {
        mega.gallery.checkEveryGalleryDelete(n.h);
        mega.gallery.albums.onCDNodeRemove(n);
    }
    else {
        mega.gallery.nodeUpdated = true;
        mega.gallery.albumsRendered = false;
    }
};

/**
 * Checking if the file is even available for the gallery
 * @param {String|MegaNode|Object} n An ufs-node, or filename
 * @param {String} [ext] Optional filename extension
 * @returns {Number|String|Function|Boolean}
 */
mega.gallery.isGalleryNode = (n, ext) => {
    'use strict';

    ext = ext || fileext(n && n.name || n, true, true);
    return n.fa && (mega.gallery.isImage(n, ext) || mega.gallery.isVideo(n));
};

/**
     * Adding a loading icon to the cell
     * @param {HTMLElement} el DOM Element to add the loading icon to
     * @param {Boolean} isVideo Whether to attach loading icon as for a video or an image
     * @returns {void}
     */
mega.gallery.setShimmering = (el) => {
    'use strict';

    // Image is already loaded
    if (el.style.backgroundImage) {
        return;
    }

    el.classList.add('shimmer');

    if (mega.gallery.hasWebAnimationsApi) {
        requestAnimationFrame(() => {
            const anims = el.getAnimations();

            for (let i = 0; i < anims.length; i++) {
                anims[i].startTime = 0;
            }
        });
    }
};

/**
 * Removing the loading icon from the cell
 * @param {HTMLElement} el DOM Element to remove the loading icon from
 * @returns {void}
 */
mega.gallery.unsetShimmering = (el) => {
    'use strict';
    el.classList.remove('shimmer');
};

/**
 * Checking if the file is qualified to have a preview
 * @param {String|MegaNode|Object} n An ufs-node, or filename
 * @param {String} [ext] Optional filename extension
 * @returns {Number|String|Function|Boolean}
 */
mega.gallery.isPreviewable = (n, ext) => {
    'use strict';
    return is_image3(n, ext) || is_video(n);
};

/**
 * Same as is_image3(), additionally checking whether the node meet requirements for photo/media gallery.
 * @param {String|MegaNode|Object} n An ufs-node, or filename
 * @param {String} [ext] Optional filename extension
 * @returns {Boolean}
 */
mega.gallery.isImage = (n, ext) => {
    'use strict';

    ext = ext || fileext(n && n.name || n, true, true);
    return !mega.gallery.disallowedExtensions[ext] && is_image3(n, ext);
};

/**
 * Checks whether the node is a video, plus checks if thumbnail is available
 * @param {Object} n ufs node
 * @returns {Object.<String, Number>|Boolean}
 */
mega.gallery.isVideo = (n) => {
    'use strict';

    if (!n || !n.fa || !n.fa.includes(':8*')) {
        return false;
    }

    const p = M.getMediaProperties(n);

    if (!p.showThumbnail || p.icon !== 'video') {
        return false;
    }

    const props = MediaAttribute.prototype.fromAttributeString(n.fa, n.k);

    return props && props.width && props.height ? p : false;
};

mega.gallery.checkEveryGalleryUpdate = n => {

    'use strict';

    // If there is discovery under gallery it means user is on discovery page.
    // And if user move/delete the folder, let's just reset gallery.
    if (mega.gallery.discovery && mega.gallery.discovery.id === n.h) {

        mega.gallery.nodeUpdated = true;

        return galleryUI(n.h);
    }

    if (n.t && M.c[n.h]) {

        const childHandles = Object.keys(M.c[n.h]);

        for (let i = childHandles.length; i--;) {
            mega.gallery.checkEveryGalleryUpdate(M.d[childHandles[i]]);
        }

        return;
    }

    if (mega.gallery.discovery) {
        mega.gallery.discovery.checkGalleryUpdate(n);
    }

    const sectionKeys = Object.keys(mega.gallery.sections);

    for (let i = 0; i < sectionKeys.length; i++) {
        const key = sectionKeys[i];

        if (mega.gallery[key]) {
            mega.gallery[key].checkGalleryUpdate(n);
        }
    }
};

mega.gallery.checkEveryGalleryDelete = h => {

    'use strict';

    if (mega.gallery.discovery) {
        mega.gallery.discovery.removeNodeByHandle(h);
    }

    const sectionKeys = Object.keys(mega.gallery.sections);

    for (let i = 0; i < sectionKeys.length; i++) {
        const key = sectionKeys[i];

        if (mega.gallery[key]) {
            mega.gallery[key].removeNodeByHandle(h);
        }
    }
};

mega.gallery.clearMdView = () => {
    'use strict';
    const $mediaIcon = $('.fm-files-view-icon.media-view').addClass('hidden');

    if (M.gallery) {
        $mediaIcon.removeClass('active');
        $('.gallery-tabs-bl').addClass('hidden');
        $(`.fm-files-view-icon.${M.viewmode ? 'block-view' : 'listing-view'}`).addClass('active');

        assert(pfid);
        M.gallery = false;
    }
};

mega.gallery.resetAll = () => {
    'use strict';

    mega.gallery.modeBeforeReset = {};

    delete mega.gallery.discovery;

    const sectionKeys = Object.keys(mega.gallery.sections);

    for (let i = 0; i < sectionKeys.length; i++) {
        const key = sectionKeys[i];

        mega.gallery.modeBeforeReset[key] = mega.gallery[key] && mega.gallery[key].mode;

        if (mega.gallery[key]) {
            delete mega.gallery[key];
        }
    }

    mega.gallery.nodeUpdated = false;
};

mega.gallery.showEmpty = (type, noMoreFiles) => {
    'use strict';

    if (noMoreFiles || M.currentrootid === M.RootID &&
        (!M.c[M.currentdirid] || !Object.values(M.c[M.currentdirid]).length)) {
        $('.fm-empty-folder', '.fm-right-files-block').removeClass('hidden');
        $(`.fm-empty-${M.currentdirid}`, '.fm-right-files-block').addClass('hidden');
        return;
    }

    if (!mega.gallery.emptyBlock) {
        mega.gallery.emptyBlock = new GalleryEmptyBlock('.fm-main.default > .fm-right-files-block');
    }

    mega.gallery.emptyBlock.type = type;
    mega.gallery.emptyBlock.show();
};

/**
 * This is specifically a check for standard PNG/WEBP thumbnails.
 * Upon creation, thumnails for new PNG/GIF/SVG/WEBP are conveniently stored as PNG or WEBP files
 * @param {ArrayBuffer|Uint8Array} ab Image array buffer
 * @returns {Boolean}
 */
mega.gallery.arrayBufferContainsAlpha = (ab) => {
    'use strict';

    const fileData = webgl.identify(ab);

    if (!fileData || fileData.format !== 'PNG') {
        return false;
    }

    // The check is based on https://www.w3.org/TR/png/#table111
    // We know format field exists in the IHDR chunk. The chunk exists at
    // offset 8 +8 bytes (size, name) +8 (depth) & +9 (type)
    // So, if it is not type 4 or 6, that would mean alpha sample is not following RGB triple
    const transparentTypes = [4, 6];

    const abType = new DataView(ab.buffer || ab).getUint8(8 + 8 + 9);

    return transparentTypes.includes(abType);
};

/**
 * A method to make/load the thumbnails of specific size based on the list of handles provided
 * @param {Array} keys Handle+size key to fetch from local database or to generate.
 * Key example: `1P9hFJwb|w320` - handle is 1P9hFJwb, width 320px
 * @param {Function} [onLoad] Single image successful load callback
 * @param {Function} [onErr] Callback when a single image is failed to load
 * @returns {void}
 */
mega.gallery.generateSizedThumbnails = async(keys, onLoad, onErr) => {
    'use strict';

    const { dbLoading } = mega.gallery;

    if (!MegaGallery.workerBranch) {
        MegaGallery.workerBranch = await webgl.worker.attach();
    }

    if (dbLoading) {
        await dbLoading;
    }

    const { workerBranch } = MegaGallery;

    const isLocationCorrect = () => {
        if (pfid || M.isGalleryPage() || M.isAlbumsPage() || M.gallery) {
            return true;
        }

        console.log(`Cancelling the thumbnail request...`);
        return false;
    };

    const processBlob = (key, blob) => {
        webgl.readAsArrayBuffer(blob)
            .then((ab) => {
                if (!isLocationCorrect()) {
                    return;
                }

                ab.type = blob.type;

                mega.gallery.lru.set(key, ab).then(() => {
                    if (!isLocationCorrect()) {
                        return;
                    }

                    onLoad(key, ab);
                });
            })
            .catch(dump);
    };

    const sizedThumbs = await mega.gallery.lru.bulkGet(keys).catch(dump) || false;
    const fetchTypes = [{}, {}];
    const faData = {};

    for (let i = 0; i < keys.length; i++) {
        if (!isLocationCorrect()) {
            return;
        }

        const key = keys[i];

        // Fetching already stored thumbnail
        if (sizedThumbs[key]) {
            onLoad(key, sizedThumbs[key]);
            continue;
        }

        const [fa, pxSize] = key.split('|w');
        const faBlocks = mega.gallery.pendingThumbBlocks[key];

        if (!faBlocks) {
            onErr(`Cannot work with blocks anymore for fa: ${fa}...`);
            continue;
        }

        const { node } = faBlocks[0];

        if (!node || !node.fa) {
            onErr(`The node ${node.h} either does not exist or is not a media file...`);
            continue;
        }

        const inThumbSize = pxSize <= MEGAImageElement.THUMBNAIL_SIZE;
        const ext = fileext(node.name || node, true, true);
        const type = inThumbSize || GalleryNodeBlock.allowsTransparent[ext] || ext === 'SVG' ? 0 : 1;

        faData[key] = {
            key,
            handle: node.h,
            byteSize: node.s,
            pxSize,
            inThumbSize,
            ext
        };

        fetchTypes[type][key] = node;
    }

    const isAbAvailable = ab => ab !== 0xDEAD && ab.byteLength > 0;

    const adjustBlobToConditions = async(key, thumbAB, type, size) => {
        let blob;

        const {
            handle,
            byteSize,
            inThumbSize,
            ext
        } = faData[key];

        // Checking if we can use the already received thumbAB, or we need to load the original
        if (
            byteSize < 8e6 // 8MB. The file size allows it to be fetched
            && (
                (!isAbAvailable(thumbAB) && type === 0) // Thumbnail is not available
                || (
                    !inThumbSize // Need bigger than the thumbnail
                    && mega.gallery.arrayBufferContainsAlpha(thumbAB) // AB contains transparent pixels
                    && GalleryNodeBlock.allowsTransparent[ext] // The image is designed to allow transparency
                )
            )
        ) {
            // The thumbnail and preview did not qualify for conditions, so original image must be fetched
            const original = await M.gfsfetch(handle, 0, -1).catch(dump);

            if (!isLocationCorrect()) {
                return;
            }

            if (original) {
                blob = await webgl.getDynamicThumbnail(original, size, workerBranch).catch(dump);
            }
        }

        return blob;
    };

    const processUint8 = async(ctx, key, thumbAB, type) => {
        if (!isLocationCorrect()) {
            return;
        }

        const abIsEmpty = !isAbAvailable(thumbAB);
        const {
            handle,
            pxSize
        } = faData[key];

        if (abIsEmpty && type === 1) { // Preview fetch is not successful
            api_getfileattr(
                { [key]: M.d[faData[key].handle] },
                0,
                (ctx1, key1, thumbAB1) => {
                    processUint8(ctx1, key1, thumbAB1, 0);
                }
            );

            onErr('The basic thumbnail image seems to be tainted...');
            return;
        }

        const size = parseInt(pxSize) | 0;

        let blob = await adjustBlobToConditions(key, thumbAB, type, size);

        if (!isLocationCorrect()) {
            return;
        }

        if (!blob && abIsEmpty) {
            console.warn('Could not fetch neither of the available image options...');
            return;
        }

        if (!blob) {
            const bak = new ArrayBuffer(thumbAB.byteLength);
            new Uint8Array(bak).set(new Uint8Array(thumbAB));

            if (bak.byteLength) {
                blob = await webgl.getDynamicThumbnail(bak, size, workerBranch).catch(dump);
            }

            if (!blob) {
                blob = new Blob([thumbAB], { type: 'image/webp' });

                if (!blob.size) {
                    blob = null;
                }
            }
        }

        if (!isLocationCorrect()) {
            return;
        }

        if (blob) {
            processBlob(key, blob);
        }
        else {
            onErr(`Could not generate dynamic thumbnail of ${size}px for ${handle}`);
        }
    };

    fetchTypes.forEach((nodes, type) => {
        if (!Object.keys(nodes).length) {
            return;
        }

        api_getfileattr(
            nodes,
            type,
            (ctx, key, thumbAB) => {
                processUint8(ctx, key, thumbAB, type);
            },
            (key) => {
                if (faData[key] && type) {
                    console.warn(`Could not receive preview image for ${key}, reverting back to thumbnail...`);

                    api_getfileattr(
                        { [key]: M.d[faData[key].handle] },
                        0,
                        (ctx1, key1, thumbAB1) => {
                            processUint8(ctx1, key1, thumbAB1, 0);
                        }
                    );
                }
            }
        );
    });
};

/**
 * Clearing the check, so the next time the DB will be re-requested
 */
mega.gallery.removeDbActionCache = () => {
    'use strict';
    MegaGallery.dbActionPassed = false;
    mega.gallery.resetAll();
};

/**
 * @param {HTMLCollection} elements The collection of the sidebar buttons
 * @param {HTMLElement} galleryBtn The gallery button
 * @returns {Promise<void>}
 */
mega.gallery.updateButtonsStates = async(elements, galleryBtn) => {
    'use strict';

    const galleryRoots = {
        photos: true,
        images: true,
        videos: true
    };
    const { getItem } = await mega.gallery.prefs.init();

    const res = getItem('web.locationPref');

    if (!res || typeof res !== 'object' || !elements[0].querySelector) {
        return;
    }

    const keys = Object.keys(res);

    for (let i = 0; i < keys.length; i++) {
        const pathKey = keys[i];

        if (!galleryRoots[pathKey]) {
            continue;
        }

        const btn = elements[0].querySelector(`.btn-galleries[data-link=${pathKey}]`);

        if (btn) {
            btn.dataset.locationPref = res[pathKey];
        }

        if (pathKey === 'photos') {
            galleryBtn.dataset.locationPref = res[pathKey];
        }
    }
};

async function galleryUI(id) {
    'use strict';

    if (self.d) {
        console.group(`Setting up gallery-view...`, M.currentdirid, id);
        console.time('gallery-ui');
    }

    loadingDialog.show('MegaGallery');

    if (mega.gallery.nodeUpdated) {
        mega.gallery.resetAll();
    }

    let gallery = mega.gallery[M.currentdirid];

    $('.gallery-close-discovery', '.gallery-tabs-bl').addClass('hidden');

    if (!mega.gallery.titleControl) {
        mega.gallery.titleControl = new GalleryTitleControl('.gallery-tabs-bl .gallery-section-title');
    }

    // cleanup existing (FM-side) MegaRender and such.
    M.v = [];
    $.selected = [];
    M.gallery |= 1;
    M.renderMain();
    delay.cancel('rmSetupUI');

    M.onTreeUIOpen(M.currentdirid);

    if (pfid || M.gallery && !M.isGalleryPage() && !M.isAlbumsPage()) {
        if (window.pfcol) {
            return mega.gallery.albums.initPublicAlbum();
        }
        id = !id || typeof id !== 'string' ? M.currentdirid : id;
        $('.view-links', '.gallery-tabs-bl').removeClass('hidden');
    }
    else {
        $('.view-links', '.gallery-tabs-bl').addClass('hidden');
    }

    // This keeps the banner persistent when navigating from Recents to Gallery
    $('.fm-right-files-block').addClass('visible-notification');

    // This is media discovery
    if (id) {
        if (!pfid) {
            mega.gallery.reporter.report(false, 'MD');
        }

        if (!M.getNodeByHandle(id) || M.getNodeRoot(id) === M.RubbishID) {

            M.openFolder(M.RootID);

            return loadingDialog.hide('MegaGallery');
        }

        mega.gallery.titleControl.title = M.d[id].name;
        mega.gallery.titleControl.icon = 'images';
        mega.gallery.titleControl.isClickable = false;
        mega.gallery.titleControl.addTooltipToTitle();

        gallery = mega.gallery.discovery;
    }
    else if (mega.gallery.sections[M.currentdirid]) {
        mega.gallery.titleControl.filterSection = M.currentdirid;
        mega.gallery.titleControl.title = mega.gallery.sections[M.currentdirid].title;
        mega.gallery.titleControl.icon = mega.gallery.sections[M.currentdirid].icon;
        mega.gallery.titleControl.removeTooltipFromTitle();
    }

    if (!gallery) {
        if (!pfid) {
            await M.getCameraUploads().catch(nop);
        }

        if (id) {
            gallery = mega.gallery.discovery = new MegaTargetGallery(id);
        }
        else if (mega.gallery.sections[M.currentdirid]) {
            gallery = mega.gallery[M.currentdirid] = new MegaMediaTypeGallery();
        }
    }

    if (gallery.id === 'favourites') {
        gallery.galleryBlock.classList.add('gallery-type-fav');
    }
    else {
        gallery.galleryBlock.classList.remove('gallery-type-fav');
    }

    gallery.setView().catch(dump).finally(() => {

        if (mega.gallery.modeBeforeReset && mega.gallery.modeBeforeReset[M.currentdirid]) {

            gallery.mode = mega.gallery.modeBeforeReset[M.currentdirid];
            mega.gallery.modeBeforeReset[M.currentdirid] = null;
        }

        gallery.setMode(gallery.mode || 'a', 2);
        gallery.render(true, true);
        gallery.bindEvents();

        loadingDialog.hide('MegaGallery');

        if (self.d) {
            console.timeEnd('gallery-ui');
            console.groupEnd();
        }
    });
}

/**
 * @param {GalleryNodeBlock[]} nodeBlocks Array of objects encapsulating setThumb and node
 * @returns {void}
 */
MegaGallery.addThumbnails = (nodeBlocks) => {
    'use strict';

    if (!GalleryNodeBlock.thumbCache) {
        GalleryNodeBlock.thumbCache = Object.create(null);
    }

    const thumbSize = 240;
    const keys = [];
    const thumbBlocks = {};

    for (let i = 0; i < nodeBlocks.length; i++) {
        if (!nodeBlocks[i].node) { // No node is associated with the block
            continue;
        }

        const { h, fa } = nodeBlocks[i].node;

        /**
         * The element width to fetch with relation to dpx
         */
        const width = parseInt(nodeBlocks[i].el.clientWidth) | 0;
        const key = MegaGallery.getCacheKey(fa, width);

        // In case fa is not arrived yet, placing the node to the buffer
        if (!fa) {
            if (!mega.gallery.pendingFaBlocks[h]) {
                mega.gallery.pendingFaBlocks[h] = Object.create(null);
            }

            mega.gallery.pendingFaBlocks[h][width] = nodeBlocks[i];
            continue;
        }
        else if (width <= thumbSize) {
            if (thumbBlocks[nodeBlocks[i].node.h]) {
                thumbBlocks[nodeBlocks[i].node.h].push(nodeBlocks[i]);
            }
            else {
                thumbBlocks[nodeBlocks[i].node.h] = [nodeBlocks[i]];
            }
            continue;
        }

        if (GalleryNodeBlock.thumbCache[key]) {
            nodeBlocks[i].setThumb(GalleryNodeBlock.thumbCache[key], nodeBlocks[i].node.fa);
            continue;
        }

        if (!keys.includes(key)) {
            keys.push(key);
        }

        if (mega.gallery.pendingThumbBlocks[key]) {
            mega.gallery.pendingThumbBlocks[key].push(nodeBlocks[i]);
        }
        else {
            mega.gallery.pendingThumbBlocks[key] = [nodeBlocks[i]];
        }

        // Stretch the image when loading
        if (nodeBlocks[i].thumb) {
            nodeBlocks[i].thumb.classList.add('w-full');
        }
    }

    // Checking if there are any re-usable thumbnails available
    const thumbHandles = Object.keys(thumbBlocks);

    if (thumbHandles.length) {
        fm_thumbnails(
            'standalone',
            thumbHandles.map(h => M.d[h]),
            ({ h, fa }) => {
                for (let i = 0; i < thumbBlocks[h].length; i++) {
                    thumbBlocks[h][i].setThumb(thumbnails.get(fa), fa);
                }
            }
        );
    }

    // All nodes are in pending state, no need to proceed
    if (!keys.length) {
        return;
    }

    mega.gallery.generateSizedThumbnails(
        keys,
        (key, arrayBuffer) => {
            const blocks = mega.gallery.pendingThumbBlocks;

            // The image has been applied already
            if (!blocks[key]) {
                return;
            }
            const weAreOnGallery = pfid || M.isGalleryPage() || M.isAlbumsPage() || M.gallery;

            if (d) {
                console.assert(weAreOnGallery, `This should not be running!`);
            }

            if (GalleryNodeBlock.thumbCache[key]) {
                for (let i = 0; i < blocks[key].length; i++) {
                    blocks[key][i].setThumb(GalleryNodeBlock.thumbCache[key], blocks[key][i].node.fa);
                }

                delete blocks[key];
                return;
            }

            if (weAreOnGallery) {
                const url = mObjectURL([arrayBuffer], arrayBuffer.type || 'image/jpeg');

                if (blocks[key]) {
                    for (let i = 0; i < blocks[key].length; i++) {
                        blocks[key][i].setThumb(url, blocks[key][i].node.fa);
                    }

                    delete blocks[key];
                }

                if (!GalleryNodeBlock.thumbCache[key]) {
                    GalleryNodeBlock.thumbCache[key] = url;

                    const cachedKeys = Object.keys(GalleryNodeBlock.thumbCache);

                    if (cachedKeys.length > GalleryNodeBlock.thumbCacheSize) {
                        GalleryNodeBlock.revokeThumb(cachedKeys[0]);
                    }
                }
            }
            else {
                delete blocks[key];
            }
        },
        (err) => {
            console.warn(`Cannot make thumbnail(s). Error: ${err}`);
        }
    );
};

MegaGallery.revokeThumbs = () => {
    'use strict';

    if (!GalleryNodeBlock.thumbCache) {
        return;
    }

    const keys = Object.keys(GalleryNodeBlock.thumbCache);

    for (let i = 0; i < keys.length; i++) {
        URL.revokeObjectURL(GalleryNodeBlock.thumbCache[keys[i]]);
    }

    GalleryNodeBlock.thumbCache = Object.create(null);
};

MegaGallery.getCacheKey = (prefix, width) => {
    'use strict';
    return width ? `${prefix}|w${parseInt(width)}` : prefix;
};

MegaGallery.handleIntersect = tryCatch((entries, gallery) => {
    'use strict';

    const toFetchAttributes = [];

    for (let i = 0; i < entries.length; i++) {
        const { isIntersecting, target: { nodeBlock } } = entries[i];

        if (!nodeBlock) {
            console.assert(false, 'MegaGallery.handleIntersect: nodeBlock not available.');
            continue;
        }

        if (isIntersecting) {
            if (!nodeBlock.isRendered) {
                nodeBlock.fill(gallery.mode);
                toFetchAttributes.push(nodeBlock);
            }

            if (Array.isArray($.selected) && $.selected.includes(nodeBlock.node.h)) {
                nodeBlock.el.classList.add('ui-selected');
            }

            if (gallery.blockSizeObserver) {
                gallery.blockSizeObserver.observe(nodeBlock.el);
            }
        }
        else if (gallery.blockSizeObserver) {
            gallery.blockSizeObserver.unobserve(nodeBlock.el);
        }
    }

    if (toFetchAttributes.length) {
        MegaGallery.addThumbnails(toFetchAttributes);
    }
});

MegaGallery.handleResize = SoonFc(200, (entries) => {
    'use strict';

    const toFetchAttributes = [];
    const fill = tryCatch((entry) => {
        const {contentRect, target: {nodeBlock}, target: {nodeBlock: {thumb}}} = entry;

        if (contentRect.width > thumb.naturalWidth) {
            toFetchAttributes.push(nodeBlock);
        }
    });

    for (let i = 0; i < entries.length; i++) {

        fill(entries[i]);
    }

    if (toFetchAttributes.length) {
        MegaGallery.addThumbnails(toFetchAttributes);
    }
});

MegaGallery.dbAction = () => {
    'use strict';

    if (fmdb && fmdb.db !== null && fmdb.crashed !== 666) {
        const ignoreHandles = MegaGallery.handlesArrToObj([
            ...M.getTreeHandles('shares'),
            ...M.getTreeHandles(M.RubbishID)
        ]);

        return fmdb.getbykey(
            'f',
            {
                query: db => db.where('fa').notEqual(fmdb.toStore('')),
                include: ({p}) => !ignoreHandles[p]
            }
        );
    }

    return Promise.reject();
};

MegaGallery.handlesArrToObj = (array) => {
    'use strict';

    const obj = Object.create(null);

    for (let i = 0; i < array.length; i++) {
        obj[array[i]] = true;
    }

    return obj;
};

lazy(mega.gallery, 'dbLoading', () => {
    'use strict';

    return LRUMegaDexie.create('gallery_thumbs', 200)
        .then((db) => {
            mega.gallery.lru = db;
        })
        .catch(dump)
        .finally(() => {
            delete mega.gallery.dbLoading;
        });
});

lazy(mega.gallery, 'sections', () => {
    'use strict';

    return {
        photos: {
            path: 'photos',
            icon: 'photos',
            root: 'photos',
            filterFn: n => mega.gallery.isGalleryNode(n),
            title: l.gallery_all_locations
        },
        [mega.gallery.secKeys.cuphotos]: {
            path: mega.gallery.secKeys.cuphotos,
            icon: 'photos',
            root: 'photos',
            filterFn: (n, cameraTree) => cameraTree && cameraTree.includes(n.p)
                && (mega.gallery.isImage(n) || mega.gallery.isVideo(n)),
            title: l.gallery_camera_uploads
        },
        [mega.gallery.secKeys.cdphotos]: {
            path: mega.gallery.secKeys.cdphotos,
            icon: 'photos',
            root: 'photos',
            filterFn: (n, cameraTree) => (!cameraTree || !cameraTree.includes(n.p))
                && (mega.gallery.isImage(n) || mega.gallery.isVideo(n)),
            title: l.gallery_from_cloud_drive
        },
        images: {
            path: 'images',
            icon: 'images',
            root: 'images',
            filterFn: n => mega.gallery.isImage(n),
            title: l.gallery_all_locations
        },
        [mega.gallery.secKeys.cuimages]: {
            path: mega.gallery.secKeys.cuimages,
            icon: 'images',
            root: 'images',
            filterFn: (n, cameraTree) => cameraTree && cameraTree.includes(n.p) && mega.gallery.isImage(n),
            title: l.gallery_camera_uploads
        },
        [mega.gallery.secKeys.cdimages]: {
            path: mega.gallery.secKeys.cdimages,
            icon: 'images',
            root: 'images',
            filterFn: (n, cameraTree) => (!cameraTree || !cameraTree.includes(n.p)) && mega.gallery.isImage(n),
            title: l.gallery_from_cloud_drive
        },
        videos: {
            path: 'videos',
            icon: 'videos',
            root: 'videos',
            filterFn: n => mega.gallery.isVideo(n),
            title: l.gallery_all_locations
        },
        [mega.gallery.secKeys.cuvideos]: {
            path: mega.gallery.secKeys.cuvideos,
            icon: 'videos',
            root: 'videos',
            filterFn: (n, cameraTree) => cameraTree && cameraTree.includes(n.p) && mega.gallery.isVideo(n),
            title: l.gallery_camera_uploads
        },
        [mega.gallery.secKeys.cdvideos]: {
            path: mega.gallery.secKeys.cdvideos,
            icon: 'videos',
            root: 'videos',
            filterFn: (n, cameraTree) => (!cameraTree || !cameraTree.includes(n.p)) && mega.gallery.isVideo(n),
            title: l.gallery_from_cloud_drive
        },
        favourites: {
            path: 'favourites',
            icon: 'favourite-filled',
            root: 'favourites',
            filterFn: n => mega.gallery.isImage(n) || mega.gallery.isVideo(n),
            title: l.gallery_favourites
        }
    };
});

lazy(mega.gallery, 'reporter', () => {
    'use strict';

    const intervals = {
        MD: {
            initEvt: 99900,
            favEvt: 99757,
            marks: [
                [10, 99753], // This timeout value is also being used for Fav reporter
                [30, 99754],
                [60, 99755],
                [180, 99756]
            ]
        },
        Album: {
            marks: [
                [10, 99931],
                [30, 99932],
                [60, 99933],
                [180, 99934]
            ]
        }
    };

    /**
     * The number to qualify as a favourite
     * @type {Number}
     */
    const timesOver = 3;

    const statsStorageKey = 'regularPageStats';

    /**
     * This one prevents events from sending same requests multiple times when leaving and coming back to the tab
     * or accidentally doubling events
     * @type {Number[]}
     */
    let passedSessionMarks = [];
    let sessionTimer = null;
    let favTimer = null;

    let fmStats = null;
    let disposeVisibilityChange = null;

    const fillStats = () => new Promise((resolve) => {
        if (fmStats !== null) {
            resolve(true);
            return;
        }

        M.getPersistentData(statsStorageKey).then((stats) => {
            if (stats) {
                fmStats = stats;
            }

            resolve(true);
        }).catch(() => {
            resolve(false);
        });
    });

    return {
        runId: 0,
        sameRun(runId) {
            return runId === this.runId && document.visibilityState !== 'hidden';
        },
        /**
         * @param {Boolean} isCarryOn Whether to carry on the paused session or not (e.g. when visibility changes)
         * @param {String} pageKey The page key to use for the reporting
         * @returns {void}
         */
        report(isCarryOn, pageKey) {
            const { initEvt, marks, favEvt } = intervals[pageKey];

            if (!isCarryOn && initEvt) {
                eventlog(initEvt);

                // We need to stop the previously initialised reporter's run if any
                if (this.runId) {
                    this.stop();
                }
            }

            this.runId = Date.now();
            const { runId } = this;

            disposeVisibilityChange = MComponent.listen(
                document,
                'visibilitychange',
                () => {
                    if (document.visibilityState === 'visible' && this.runId === runId) {
                        this.report(true, pageKey);
                    }
                }
            );

            sessionTimer = this.reportSessionMarks(marks[0][0], 0, runId, pageKey);

            if (favEvt) {
                favTimer = this.processSectionFavourite(runId, pageKey);
            }

            mBroadcaster.once('pagechange', () => {
                this.stop();
            });
        },
        /**
         * Sending time marks if the session time is surpassing a specific value
         * @param {Number} timeout
         * @param {Number} diff Timeout to the next mark
         * @param {Number} runId Current report run id to check
         * @param {String} pageKey The page key to use for the reporting
         */
        reportSessionMarks(timeout, diff, runId, pageKey) {
            const { marks } = intervals[pageKey];
            const eventIndex = marks.findIndex(([to]) => to === timeout);
            const timer = tSleep(timeout - diff);

            timer.then(
                () => {
                    if (!this.sameRun(runId)) {
                        sessionTimer = null;
                        return;
                    }

                    if (!passedSessionMarks.includes(timeout)) {
                        passedSessionMarks.push(timeout);

                        delay(
                            `gallery_stat_${marks[eventIndex][1]}`,
                            eventlog.bind(null, marks[eventIndex][1], `Session mark: ${pageKey} | ${timeout}s`)
                        );
                    }

                    const nextIndex = eventIndex + 1;
                    if (marks[nextIndex]) {
                        sessionTimer = this.reportSessionMarks(marks[nextIndex][0], timeout, runId, pageKey);
                    }
                    else {
                        sessionTimer = null;
                    }
                }
            );

            return timer;
        },
        /**
         * Report if user visited a specific section/page more than timesOver times
         * @param {Number} runId Current report run id to check
         * @param {String} pageKey The page key to use for the reporting
         */
        processSectionFavourite(runId, pageKey) {
            const { marks, favEvt } = intervals[pageKey];
            const timer = tSleep(marks[0][0]);

            timer.then(() => {
                if (!this.sameRun(runId)) {
                    favTimer = null;
                    return;
                }

                fillStats().then((status) => {
                    if (!status) {
                        fmStats = [];
                    }

                    let section = fmStats.find(({ name }) => name === pageKey);

                    if (section) {
                        section.count++;
                    }
                    else {
                        section = { name: pageKey, count: 1, reported: false };
                        fmStats.push(section);
                    }

                    if (!section.reported) {
                        if (section.count >= timesOver) {
                            section.reported = true;
                            delay(
                                `gallery_stat_${favEvt}`,
                                eventlog.bind(null, favEvt, `${pageKey} has been visited ${section.count} times`)
                            );
                        }

                        M.setPersistentData(statsStorageKey, fmStats).catch(() => {
                            console.error('Cannot save stats - the storage is most likely full...');
                        });
                    }
                });
            });

            return timer;
        },
        stop() {
            if (typeof disposeVisibilityChange === 'function') {
                disposeVisibilityChange();
            }

            this.runId = 0;
            passedSessionMarks = [];

            if (sessionTimer) {
                sessionTimer.abort();
            }

            if (favTimer) {
                favTimer.abort();
            }
        }
    };
});

lazy(mega.gallery, 'prefs', () => {
    'use strict';

    const prefKey = 'ccPref';
    let data = {};

    const saveUserAttribute = async() => {
        const res = await Promise.resolve(mega.attr.get(u_attr.u, prefKey, false, true)).catch(dump);

        if (res && res.cc && typeof res.cc === 'string') {
            tryCatch(() => {
                const tmp = JSON.parse(res.cc);
                const tmpKeys = Object.keys(tmp);

                for (let i = 0; i < tmpKeys.length; i++) {
                    const key = tmpKeys[i];

                    if (key === 'web') {
                        continue;
                    }

                    data[key] = tmp[key];
                }
            })();
        }

        mega.attr.set(prefKey, { cc: JSON.stringify(data) }, false, true).catch(dump);
    };

    const p = {
        init: async() => {
            if (!u_attr) {
                dump('Gallery preferences are disabled for guests...');
                return;
            }

            if (p.getItem) {
                return p;
            }

            if (!p.isInitializing) {
                p.isInitializing = Promise.resolve(mega.attr.get(u_attr.u, prefKey, false, true)).catch(dump);

                p.isInitializing
                    .then((res) => {
                        if (res && res.cc && typeof res.cc === 'string') {
                            tryCatch(() => {
                                data = JSON.parse(res.cc);
                            })();
                        }
                    })
                    .finally(() => {
                        if (p.isInitializing) {
                            delete p.isInitializing;
                        }
                    });
            }

            await p.isInitializing;

            if (!p.getItem) {
                /**
                 * Getting the value by traversing through the dotted key
                 * @param {String|String[]} keys Key(s) to use. Format is 'root.childKey1.childKey2...'
                 * @param {Object.<String, any>} d Data to traverse through recursively
                 * @returns {any}
                 */
                p.getItem = (keys, d) => {
                    if (typeof keys === 'string') {
                        keys = keys.split('.');
                    }

                    if (!d) {
                        d = data;
                    }

                    const key = keys.shift();

                    return (keys.length && d[key]) ? p.getItem(keys, d[key]) : d[key];
                };

                /**
                 * Removing the value by traversing through the dotted key
                 * @param {String|String[]} keys Key(s) to use. Format is 'root.childKey1.childKey2...'
                 * @param {Object.<String, any>} d Data to traverse through recursively
                 * @returns {void}
                 */
                p.removeItem = (keys, d) => {
                    if (typeof keys === 'string') {
                        keys = keys.split('.');
                    }

                    if (!d) {
                        d = data;
                    }

                    const key = keys.shift();

                    if (!d[key]) {
                        saveUserAttribute();
                        return;
                    }

                    if (keys.length) {
                        p.removeItem(keys, d[key]);
                    }
                    else {
                        delete d[key];
                        saveUserAttribute();
                    }
                };

                /**
                 * Updating the value by traversing through the dotted key
                 * @param {String|String[]} keys Key(s) to use. Format is 'root.childKey1.childKey2...'
                 * @param {any} value Value to set
                 * @param {Object.<String, any>} d Data to traverse through recursively
                 * @returns {void}
                 */
                p.setItem = (keys, value, d) => {
                    if (typeof keys === 'string') {
                        keys = keys.split('.');
                    }

                    if (!d) {
                        d = data;
                    }

                    const key = keys.shift();

                    if (!d[key]) {
                        d[key] = {};
                    }

                    if (!keys.length) {
                        d[key] = value;
                        saveUserAttribute();
                        return;
                    }

                    if (typeof d[key] !== 'object') {
                        d[key] = {};
                    }

                    p.setItem(keys, value, d[key]);
                };
            }

            return p;
        }
    };

    return p;
});

lazy(mega.gallery, 'albums', () => {
    'use strict';

    const scope = mega.gallery;

    /**
     * Globally storing disposing callback for convenience
     */
    scope.disposeKeyboardEvents = null;

    /**
     * This is a margin for the cell to render within the row
     * @type {Number}
     */
    scope.cellMargin = 4;

    /**
     * Checking whether an event is being dispatched with Ctrl key in hold
     * @param {Event} evt Event object to check
     * @returns {Boolean}
     */
    scope.getCtrlKeyStatus = ({ ctrlKey, metaKey }) => metaKey || ctrlKey;

    /**
     * How many items can be selected at once when add to an album per batch
     */
    scope.maxSelectionsCount = 1500;

    scope.getAlbumIdFromPath = () => {
        if (M.currentdirid && M.currentdirid.startsWith('albums/')) {
            return M.currentdirid.replace(/^albums\//, '');
        }

        if (pfcol) {
            const albumIds = Object.keys(scope.albums.store);

            for (let i = 0; i < albumIds.length; i++) {
                const { filterFn, p, id } = scope.albums.store[albumIds[i]];

                if (!filterFn && id && p && p.ph === pfid) {
                    return id;
                }
            }
        }

        return '';
    };

    /**
     * Reporting album content download event
     * @returns {void}
     */
    scope.reportDownload = () => {
        if (pfcol) {
            eventlog(99954);
        }

        const onlySelection = scope.albums.grid.timeline && scope.albums.grid.timeline.selCount > 0;
        eventlog((onlySelection) ? 99793 : 99792);
    };

    /**
     * Checking whether an element is in select area, checking if at least two edges are within the area
     * @param {HTMLElement} domEl Dom element
     * @param {Number[]} area Coordinates of the selection
     * @param {Number} containerPadding The left padding of the container
     * @returns {Boolean}
     */
    scope.isInSelectArea = (domEl, [left, right, top, bottom], containerPadding = 0) => {
        const offsetLeft = domEl.offsetLeft + containerPadding;
        const offsetTop = domEl.offsetTop;
        const rightEdge = offsetLeft + domEl.offsetWidth;
        const bottomEdge = offsetTop + domEl.offsetHeight;

        const fitVert = (offsetTop >= top && offsetTop <= bottom) || (bottomEdge >= top && bottomEdge <= bottom);
        const fitHoriz = (offsetLeft <= right && offsetLeft >= left) || (rightEdge >= left && rightEdge <= right);

        return (fitVert && (fitHoriz || offsetLeft < left && rightEdge > right))
            || fitHoriz && offsetTop < top && bottomEdge > bottom && fitHoriz;
    };

    /**
     * Re-initiating the events which are being paused due to dialogs
     * @returns {void}
     */
    scope.reinitiateEvents = () => {
        delay('render:album_events_reinitiate', () => {
            if (scope.albums.grid && !$.dialog) {
                if (M.isAlbumsPage(1)) {
                    scope.albums.grid.attachKeyboardEvents();
                }
                else {
                    const timelineEl = scope.albums.grid.el.querySelector('.album-timeline-main');

                    if (timelineEl) {
                        timelineEl.mComponent.attachKeyboardListener();

                        if (timelineEl.mComponent.dragSelect) {
                            timelineEl.mComponent.dragSelect.disabled = false;
                        }
                    }
                }
            }
        });
    };

    let tmpMv = [];
    let previewMvLength = 0;

    /**
     * Launching the slideshow right away (in fullscreen mode)
     * @param {String} albumId Album ID
     * @param {Boolean} useFullscreen Skipping videos and playing in the fullscreen
     * @param {Boolean} autoplay Whether to start the slideshow right away or not
     * @returns {void}
     */
    scope.playSlideshow = (albumId, useFullscreen, autoplay) => {
        const album = scope.albums.store[albumId];

        if (album && album.nodes.length > 0) {
            const selHandles = (scope.albums.grid && scope.albums.grid.timeline)
                ? Object.keys(scope.albums.grid.timeline.selections)
                : [];
            const firstNode = (selHandles.length)
                ? album.nodes.find((n) => scope.albums.grid.timeline.selections[n.h] && scope.isPreviewable(n))
                : album.nodes.find((n) => !scope.isVideo(n) && scope.isPreviewable(n));

            if (!firstNode) {
                console.warn('Could not find the first node for the slideshow...');
                return;
            }

            if (autoplay) {
                $.autoplay = firstNode.h;
            }

            tmpMv = M.v;
            scope.fillMainView([...album.nodes]);
            previewMvLength = M.v.length;

            slideshow(firstNode, false);

            scope.albums.removeKeyboardListener();

            delay('toggle:album_slideshow_on', () => {
                if (useFullscreen) {
                    const slideshowBtn = $('.v-btn.slideshow', 'footer');

                    if (slideshowBtn) {
                        slideshowBtn.click();
                    }

                    const fullscreenHandler = () => {
                        if (!document.fullscreenElement) {
                            $('.v-btn.close', 'section.media-viewer-container').click();
                            window.removeEventListener('fullscreenchange', fullscreenHandler);
                        }
                    };

                    window.addEventListener('fullscreenchange', fullscreenHandler);
                }

                const eventsToDisposeOnClose = [];
                const selectModifiers = [
                    '.media-viewer header nav.viewer-bars button.options',
                    '.media-viewer header nav.viewer-bars button.send-to-chat'
                ];
                const modifySelection = () => {
                    $.selected = [slideshow_handle()];
                };

                for (let i = 0; i < selectModifiers.length; i++) {
                    eventsToDisposeOnClose.push(
                        MComponent.listen(selectModifiers[i], 'click', modifySelection)
                    );
                }

                mBroadcaster.once('slideshow:close', () => {
                    scope.fillMainView(tmpMv);

                    scope.reinitiateEvents();

                    if (window.selectionManager.clearSlideshowSelections) {
                        window.selectionManager.clearSlideshowSelections();
                    }

                    for (let i = 0; i < eventsToDisposeOnClose.length; i++) {
                        eventsToDisposeOnClose[i]();
                    }

                    if (M.isAlbumsPage(1) || !selHandles.length) {
                        window.selectionManager.hideSelectionBar();
                    }
                    else {
                        window.selectionManager.showSelectionBar(
                            mega.icu.format(l.album_selected_items_count, album.nodes.length)
                                .replace('%1', selHandles.length)
                        );
                    }
                });
            });
        }
    };

    /**
     * Checking if the provided nodes qualify for the slideshow action
     * @param {MegaNodep[]} nodes Nodes to check against
     * @returns {Boolean}
     */
    scope.nodesAllowSlideshow = (nodes) => {
        if (nodes.length <= 1) {
            return false;
        }

        let imgCount = 0;

        for (let i = 0; i < nodes.length; i++) {
            if (scope.isImage(nodes[i])) {
                imgCount++;

                if (imgCount > 1) {
                    return true;
                }
            }
        }

        return false;
    };

    /**
     * Fetching all MegaNode handles from specified albums
     * @param {String[]} albumIds ID of albums to fetch handles from
     * @returns {String[]}
     */
    scope.getAlbumsHandles = (albumIds) => {
        const handles = [];

        if (
            albumIds.length === 1
            && albumIds[0] === scope.getAlbumIdFromPath()
            && scope.albums.grid.timeline.selCount > 0
        ) {
            handles.push(...Object.keys(scope.albums.grid.timeline.selections));
        }
        else {
            for (let i = 0; i < albumIds.length; i++) {
                const album = scope.albums.store[albumIds[i]];

                if (album && album.nodes && album.nodes.length) {
                    handles.push(...album.nodes.map(({ h }) => h));
                }
            }
        }

        return handles;
    };

    const timemarks = {
        albumCreateStarted: 0,
        albumItemsSelectStarted: 0,
        albumCreateNamed: 0
    };

    /**
     * Indicates which files should not be considered as raw as of now to match other platforms
     * @type {Object.<String, Boolean>}
     */
    const ignoreRaws = {
        "ARI": true,
        "ARQ": true,
        "BAY": true,
        "BMQ": true,
        "CAP": true,
        "CINE": true,
        "CR3": true,
        "DC2": true,
        "DRF": true,
        "DSC": true,
        "EIP": true,
        "FFF": true,
        "IA": true,
        "KC2": true,
        "MDC": true,
        "OBM": true,
        "ORI": true,
        "PTX": true,
        "PXN": true,
        "QTK": true,
        "RDC": true,
        "RWZ": true,
        "STI": true
    };

    /**
     * This length is being used for identification of the predefined album in the list
     * @type {Number}
     */
    const predefinedKeyLength = 3;

    /**
     * The maximum number of buttons allowed without grouping to `More`
     * @type {Number}
     */
    const headerBtnLimit = 2;

    /**
     * This is the default name to be used when
     * @type {String}
     */
    const defaultAlbumName = l.album_def_name;

    /**
     * How many times to propose default label name before giving up
     * @type {Number}
     */
    const maxLabelPropositions = 10000;

    /**
     * The limit for number of albums on when to make the grid finer
     * @type {Number}
     */
    const bigAlbumCellsLimit = 4;

    /**
     * @type {Number}
     */
    const nameLenLimit = 40;

    /**
     * Storing the name value for just created album
     * @type {String}
     */
    let pendingName = '';

    const isMSync = () => window.useMegaSync === 2 || window.useMegaSync === 3;

    /**
     * @returns {String[]}
     */
    const unwantedHandles = () => MegaGallery.handlesArrToObj([
        ...M.getTreeHandles(M.RubbishID),
        ...M.getTreeHandles('shares')
    ]);

    /**
     * Trimming name if it is too long
     * @param {String} name Name to trim
     * @returns {String}
     */
    const limitNameLength = name => (name.length > nameLenLimit) ? name.substring(0, nameLenLimit) + '...' : name;

    const getAlbumsCount = () => Object.values(scope.albums.store).filter(({ filterFn }) => !filterFn).length;

    const openMainPage = () => {
        M.openFolder('albums');
    };

    /**
     * @param {HTMLElement} el DOM element to apply PerfectScroll to
     * @param {Boolean} isEmpty Whether the Album list or Album content page is empty or not
     * @returns {void}
     */
    const applyPs = (el, isEmpty = false) => {
        if (isEmpty) {
            Ps.destroy(el);
        }
        else if (el.classList.contains('ps')) {
            Ps.update(el);
        }
        else {
            Ps.initialize(el);
        }
    };

    /**
     * Sorting nodes in a specific album
     * @param {MegaNode[]} nodes Nodes array to sort
     * @returns {void}
     */
    const sortInAlbumNodes = (nodes) => {
        const sort = M.sortByModTimeFn3();
        nodes.sort((a, b) => sort(a, b, -1));
    };

    const debouncedLoadingUnset = () => {
        delay('album:hide_loading_dialog', () => {
            loadingDialog.hide('MegaAlbums');
        });
    };

    /**
     * Updating the album cell if available
     * @param {String} albumId Album id
     * @param {Boolean} sortNodes Whether to re-sort existing nodes or not
     * @param {Boolean} forceCoverUpdate Whether to reset the cover to first node of album
     * @param {Node} coverNode Node that should be used as the cover
     * @returns {void}
     */
    const debouncedAlbumCellUpdate = (albumId, sortNodes = false, forceCoverReset = false, coverNode = undefined) => {
        const album = scope.albums.store[albumId];

        if (!album) {
            return;
        }

        delay('album:' + albumId + ':update_placeholder', () => {
            if (sortNodes) {
                sortInAlbumNodes(album.nodes);
            }

            let coverUpdated = false;

            if (forceCoverReset || !album.nodes.length) {
                album.node = album.nodes[0];
                coverUpdated = true;
            }
            else if (coverNode) {
                album.node = coverNode;
                coverUpdated = true;
            }
            else {
                const shouldUpdateCover = (album.filterFn)
                    ? !album.node || album.nodes[0].h !== album.node.h
                    : !album.node
                        || !album.at.c
                        || !album.eIds[album.at.c]
                        || album.eIds[album.at.c] !== album.node.h
                    ;

                if (shouldUpdateCover) {
                    album.node = album.nodes[0];
                    coverUpdated = true;
                }
            }

            if (album.cellEl) {
                album.cellEl.updatePlaceholders();

                if (coverUpdated) {
                    album.cellEl.updateCoverImage();
                }
            }
        });
    };

    const storeLastActiveTab = () => {
        const activeBtn = document.querySelector('.lp-content-wrap.library-panel > button.active');

        if (!activeBtn) {
            return;
        }

        const activeClass = [...activeBtn.classList].find(c => !!M.fmTabState[c]);

        if (!activeClass) {
            return;
        }

        M.fmTabState[activeClass].prev = M.currentdirid;
        M.lastActiveTab = activeClass;
    };

    /**
     * @param {String} text Text to use inside the toast
     * @returns {HTMLElement}
     */
    const generateToastContent = (text) => {
        const textEl = document.createElement('div');
        textEl.className = 'flex flex-1';
        textEl.textContent = text;

        const content = document.createElement('div');
        content.className = 'flex flex-row items-center px-3 w-full';
        content.appendChild(textEl);

        return content;
    };

    /**
     * Generating the download options menu
     * @param {String[]} albumIds IDs of albums to fetch handles from
     * @returns {Object.<String, any>}
     */
    const generateDownloadOptions = (albumIds) => {
        return [
            {
                label: l[5928],
                icon: 'download-standard',
                click: () => {
                    const handles = scope.getAlbumsHandles(albumIds);

                    if (handles.length) {
                        scope.reportDownload();
                        M.addDownload(handles);
                    }
                }
            },
            {
                label: l[864],
                icon: 'download-zip',
                click: () => {
                    const handles = scope.getAlbumsHandles(albumIds);

                    if (handles.length) {
                        scope.reportDownload();
                        M.addDownload(
                            handles,
                            true,
                            false,
                            albumIds.length > 1 ? 'Album-archive-1' : scope.albums.store[albumIds[0]].label
                        );
                    }
                }
            }
        ];
    };

    /**
     * Generating the download item for context menu
     * @param {String[]} albumIds IDs of target albums
     * @returns {Object.<String, any>}
     */
    const generateDownloadMenuItem = (albumIds) => {
        return {
            label: l.download_option,
            icon: 'download-small',
            click: () => {
                const handles = scope.getAlbumsHandles(albumIds);

                if (handles.length) {
                    scope.reportDownload();
                    M.addDownload(handles);
                }
            },
            children: (isMSync()) ? undefined : generateDownloadOptions(albumIds)
        };
    };

    const fillAlbumCell = (el) => {
        const div = document.createElement('div');
        const titleEl = document.createElement('div');
        el.album.cellEl.countEl = document.createElement('div');

        titleEl.textContent = el.album.label;
        titleEl.className = 'album-label text-ellipsis';
        titleEl.setAttribute('title', el.album.label);

        div.appendChild(titleEl);
        div.appendChild(el.album.cellEl.countEl);

        el.album.cellEl.updatePlaceholders();
        el.appendChild(div);
    };

    /**
     * Sorting albums by given names in attributes
     * @param {String} labelA Album label A
     * @param {String} labelB Album label B
     * @param {String} direction Default is ascending order (1)
     * @returns {Number}
     */
    const sortLabels = (labelA, labelB, direction = 1) => {
        if (labelA < labelB) {
            return -direction;
        }

        if (labelA > labelB) {
            return direction;
        }

        return 0;
    };

    const sortAlbumsArray = (a, b) => {
        if ((a.filterFn && b.filterFn) || a.cts === b.cts) {
            return sortLabels(a.label, b.label);
        }

        if (a.filterFn) {
            return -1;
        }
        else if (b.filterFn) {
            return 1;
        }

        return b.cts - a.cts;
    };

    const sortStore = () => {
        const albumKeys = Object.keys(scope.albums.store);

        albumKeys.sort((keyA, keyB) => sortAlbumsArray(
            scope.albums.store[keyA],
            scope.albums.store[keyB]
        ));

        const obj = Object.create(null);

        for (let i = 0; i < albumKeys.length; i++) {
            obj[albumKeys[i]] = scope.albums.store[albumKeys[i]];
        }

        scope.albums.store = obj;
    };

    /**
     * @param {String} name Album name to check against others
     * @param {String} ignoreId Ignore specific id, ususally it's current Album ID
     * @returns {void}
     */
    const albumNameExists = (name, ignoreId) => Object
        .values(scope.albums.store)
        .some(({ label, id }) => label === name && id !== ignoreId);

    const getFirstUserAlbum = (ignoreId) => {
        const keys = Object.keys(scope.albums.store);

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];

            if (key.length !== predefinedKeyLength && key !== ignoreId) {
                return scope.albums.store[key];
            }
        }

        return null;
    };

    /**
     * Checking whether an album needs to be rendered in the tree and on main page or not
     * @param {Object} album Album data to check
     * @returns {Boolean}
     */
    const albumIsRenderable = ({ filterFn, nodes }) => !filterFn || (Array.isArray(nodes) && nodes.length);

    /**
     * Inserting the album related element in the proper place in the list
     * @param {String} albumId Album ID
     * @param {HTMLElement} domElement DOM element to insert
     * @param {HTMLElement} domContainer DOM element to insert into
     * @param {String} siblingComponentKey key to use in album upon sibling element fetch
     * @returns {void}
     */
    const insertAlbumElement = (albumId, domElement, domContainer, siblingComponentKey) => {
        /**
         * Active album keys
         * @type {String[]}
         */
        const aKeys = [];

        /**
         * All albums keys
         * @type {String[]}
         */
        const keys = Object.keys(scope.albums.store);

        for (let i = 0; i < keys.length; i++) {
            if (albumIsRenderable(scope.albums.store[keys[i]])) {
                aKeys.push(keys[i]);
            }
        }

        const aIndex = aKeys.indexOf(albumId);

        if (M.currentdirid === 'albums/' + albumId) {
            domElement.classList.add('active');
        }

        if (aIndex === aKeys.length - 1) {
            domContainer.appendChild(domElement);
        }
        else {
            domContainer.insertBefore(
                domElement,
                scope.albums.store[aKeys[aIndex + 1]][siblingComponentKey].el
            );
        }
    };

    /**
     * Removing the node from album in store
     * @param {String} albumId Album ID
     * @param {String} handle Node handle
     * @returns {void}
     */
    const removeNodeFromAlbum = (albumId, handle) => {
        const album = scope.albums.store[albumId];

        if (!album || (!album.filterFn && !album.eHandles[handle])) {
            return;
        }

        let nodeSpliced = false;

        for (let j = 0; j < album.nodes.length; j++) {
            const { h } = album.nodes[j];

            if (h === handle) {
                album.nodes.splice(j, 1);
                nodeSpliced = true;
                break;
            }
        }

        if (!nodeSpliced) {
            return;
        }

        if (album.filterFn && !album.nodes.length) {
            scope.albums.removeAlbumFromGridAndTree(albumId);
        }

        debouncedAlbumCellUpdate(albumId, false, !!album.node && album.node.h === handle);

        const { grid } = scope.albums;

        if (grid) {
            if (M.isAlbumsPage(1)) {
                delay('album:refresh_main_grid', () => {
                    grid.refresh();
                });
            }
            else if (albumId === scope.getAlbumIdFromPath()) {
                if (grid.timeline) {
                    if (grid.timeline.selections[handle]) {
                        grid.timeline.deselectNode(M.d[handle]);
                    }

                    if (grid.timeline.selCount > 0) {
                        window.selectionManager.showSelectionBar(
                            mega.icu.format(l.album_selected_items_count, album.nodes.length)
                                .replace('%1', grid.timeline.selCount)
                        );
                    }
                    else {
                        window.selectionManager.hideSelectionBar();
                    }
                }

                if (album.nodes.length) {
                    delay('album:' + albumId + ':remove_items', () => {
                        if (grid.timeline) {
                            grid.timeline.nodes = album.nodes;
                        }

                        if (M.currentdirid === albumId) {
                            grid.header.update(albumId);
                        }
                    });
                }
                else if (album.filterFn) {
                    openMainPage();
                    grid.showAllAlbums();
                }
                else {
                    grid.showEmptyAlbumPage(albumId);
                }
            }
        }
    };

    /**
     * Removing the node from album timeline in dialog
     * @param {String} handle Node handle
     * @returns {void}
     */
    const removeNodeFromTimelineDialog = (handle) => {
        const timeline = $.timelineDialog.timeline;

        if (timeline) {
            if (timeline.selections[handle]) {
                timeline.deselectNode(M.d[handle]);
                $.timelineDialog.updateSelectedCount(timeline.selCount);
            }

            delay('timeline_dialog:remove_items', () => {
                timeline.nodes = M.v;
            });
        }
    };

    /**
     * Checking if there is at least one active album available for the list
     * @returns {Boolean}
     */
    const checkIfExpandable = () => Object
        .values(scope.albums.store)
        .some(album => albumIsRenderable(album));

    /**
     * Checking if the provided name is preserved by auto-generated albums
     * @param {String} name The name to check against system values
     * @returns {Boolean}
     */
    const isSystemAlbumName = (name) => {
        name = name.toLowerCase();

        return Object.keys(scope.albums.store)
            .filter(k => k.length === predefinedKeyLength)
            .some(k => scope.albums.store[k].label.toLowerCase() === name);
    };

    /**
     * Proposing the name for a new album based on the default value plus counter
     * @returns {String}
     */
    const proposeAlbumName = () => {
        const currentNames = {};
        const albums = Object.values(scope.albums.store);

        for (let i = 0; i < albums.length; i++) {
            const { label } = albums[i];

            if (label.startsWith(defaultAlbumName)) {
                currentNames[label] = true;
            }
        }

        const namesCount = Object.values(currentNames).length;

        if (!namesCount || !currentNames[defaultAlbumName]) {
            return defaultAlbumName;
        }

        for (let i = 1; i <= maxLabelPropositions; i++) {
            const newName = defaultAlbumName + ' (' + i + ')';

            if (!currentNames[newName]) {
                return newName;
            }
        }

        return '';
    };

    /**
     * Checking which predefined active album is preceding the current one
     * @param {String} albumId Album ID
     * @param {String} elKey Which subelement to use as an active checker
     * @returns {Object.<String, any>?}
     */
    const getPrevActivePredefinedAlbum = (albumId, elKey) => {
        const keys = Object.keys(scope.albums.store).filter(k => k.length === predefinedKeyLength);
        const index = keys.indexOf(albumId);
        let prev = null;

        if (index < 0) {
            return;
        }

        for (let i = 0; i < index; i++) {
            const album = scope.albums.store[keys[i]];

            if (album.nodes && album.nodes.length && album[elKey]) {
                prev = album;
            }
        }

        return prev;
    };

    class AlbumsSelectionManager extends SelectionManager2_DOM {
        constructor(albumId, container, eventHandlers) {
            super(container, eventHandlers);
            this.currentdirid = `albums/${albumId}`;
            this._boundEvents = [];
            this.init();
            this.albumId = albumId;
            this.timeline = container;
        }

        get items() {
            return scope.albums.store[this.albumId] ? scope.albums.store[this.albumId].nodes : [];
        }

        get items_per_row() {
            return scope.AlbumTimeline.zoomSteps[this.timeline.zoomStep];
        }

        clearSlideshowSelections() {
            const cells = scope.albums.grid.timeline ? scope.albums.grid.timeline.cellCache : {};

            for (let i = 0; i < Object.keys(cells).length; i++) {
                const mComponent = cells[Object.keys(cells)[i]];

                if (!mComponent._selected) {
                    mComponent.el.classList.remove('ui-selected');
                }
            }
        }
    }

    class DownloadContextMenu extends MMenuSelect {
        constructor(albumId) {
            super();
            this.options = generateDownloadOptions([albumId]);
        }
    }

    class TimelineDialog extends MDialog {
        hide() {
            if (this.timeline) {
                this.timeline.clear();
                delete this.timeline;
            }

            super.hide();
        }
    }

    class ToCopyInput extends MComponent {
        constructor(isKey) {
            super();

            this.copyResponse = (isKey)
                ? mega.icu.format(l.toast_copy_key, 1)
                : mega.icu.format(l.toast_copy_link, 1);

            const inputIcon = document.createElement('i');
            inputIcon.className = `sprite-fm-mono ${isKey ? 'icon-key' : 'icon-link'}`;
            this.wrap.prepend(inputIcon);
        }

        get value() {
            return this.input.value;
        }

        set value(value) {
            this.input.value = value;
        }

        buildElement() {
            this.el = document.createElement('div');
            this.el.className = 'item-link link flex-1';

            this.wrap = document.createElement('div');
            this.wrap.className = 'input-wrap';

            this.input = document.createElement('input');
            this.input.type = 'text';
            this.input.readOnly = true;
            this.copyBtn = new MButton(
                l[63],
                null,
                () => {
                    copyToClipboard(this.input.value, this.copyResponse);
                },
                'mega-button positive copy current'
            );

            this.wrap.appendChild(this.input);
            this.el.appendChild(this.wrap);
            this.el.appendChild(this.copyBtn.el);
        }
    }

    class RemoveShareDialog extends MDialog {
        constructor(albumIds) {
            super({
                ok: {
                    label: albumIds.length > 1 ? l[8735] : l[6821],
                    callback: () => {
                        scope.albums.removeShare(albumIds);
                    },
                    classes: ['mega-button', 'branded-green']
                },
                cancel: {
                    label: l[82]
                },
                dialogClasses: null,
                leftIcon: 'sprite-fm-uni icon-question icon-size-16',
                doNotShowCheckboxText: l.do_not_show_this_again
            });

            this.setContent(albumIds);
            this.addConfirmationCheckbox(
                () => mega.config.get('nowarnpl'),
                (val) => {
                    const currentVal = !!mega.config.get('nowarnpl');

                    if (val !== currentVal) {
                        mega.config.setn('nowarnpl', val ? 1 : undefined);
                    }
                }
            );
        }

        setContent(albumIds) {
            const p = document.createElement('p');
            p.className = 'px-6';

            p.textContent = mega.icu.format(l.plink_remove_dlg_text_album, albumIds.length);

            this.slot = p;
            this.title = mega.icu.format(l.plink_remove_dlg_title_album, albumIds.length);
        }
    }

    const removeShareWithConfirmation = (albumIds) => {
        if (mega.config.get('nowarnpl')) {
            scope.albums.removeShare(albumIds);
        }
        else {
            const dialog = new RemoveShareDialog(albumIds);
            dialog.show();
        }
    };

    class AlbumShareLinkBlock extends MComponent {
        /**
         * @param {HTMLElement} parent Parent DOM element
         * @param {String} albumId Album id to build the data upon
         * @param {Boolean} [amongOthers] Indicates if the link is in the list by itself or with others
         * @param {Function?} [onRemoveClick] Callback to fire when the remove button is pressed
         */
        constructor(parent, albumId, amongOthers = false, onRemoveClick = null) {
            super(parent);

            this._separated = false;
            this.amongOthers = amongOthers;
            this.album = scope.albums.store[albumId];
            this.onRemoveClick = onRemoveClick;
        }

        get linkString() {
            return this.linkInput.value;
        }

        get keyString() {
            return this.keyInput.value;
        }

        /**
         * @param {Object.<String, any>} album Album to build link for
         * @returns {void}
         */
        set album(album) {
            this._album = album;

            const { label, nodes } = this._album;

            this.labelEl.textContent = label;
            this.countEl.textContent = mega.icu.format(l.album_items_count, nodes.length);
            this.updateInputValue();
        }

        /**
         * @param {Boolean} status Whether the key should be separated or not
         */
        set keySeparated(status) {
            if (this._separated === status) {
                return;
            }

            this._separated = status;

            if (status) {
                if (this.keyInput) {
                    return;
                }

                this.linkInput.el.classList.add('mr-4');
                this.keyInput = new ToCopyInput(true);
                this.keyInput.value = a32_to_base64(decrypt_key(u_k_aes, base64_to_a32(this._album.k)));
                this.flexContainer.appendChild(this.keyInput.el);
                this.updateInputValue();
            }
            else {
                if (!this.keyInput) {
                    return;
                }

                this.keyInput.detachEl();
                delete this.keyInput;
                this.linkInput.el.classList.remove('mr-4');
                this.updateInputValue();
            }
        }

        updateInputValue() {
            const { p: { ph }, k } = this._album;

            let value = `${getBaseUrl()}/collection/${ph}`;

            if (!this._separated) {
                value += `#${a32_to_base64(decrypt_key(u_k_aes, base64_to_a32(k)))}`;
            }

            this.linkInput.value = value;
        }

        buildElement() {
            this.el = document.createElement('div');
            this.el.className = 'bg-surface-main p-3 mt-2 border-radius-1';

            const headerContainer = document.createElement('div');
            headerContainer.className = 'relative';
            const header = document.createElement('div');
            header.className = 'flex flex-row items-center max-w-full w-min-content mb-2 pr-28';

            const icon = document.createElement('i');
            icon.className = 'sprite-fm-mono icon-album icon-blue icon-size-5 mx-2';

            const separator = document.createElement('i');
            separator.className = 'sprite-fm-mono icon-dot icon-size-3 mt-1 mx-1';

            this.labelEl = document.createElement('div');
            this.labelEl.className = 'flex-1 text-ellipsis';
            this.countEl = document.createElement('span');
            this.countEl.className = 'white-space-nowrap';

            header.appendChild(icon);
            header.appendChild(this.labelEl);
            header.appendChild(separator);
            header.appendChild(this.countEl);
            headerContainer.appendChild(header);

            this.flexContainer = document.createElement('div');
            this.flexContainer.className = 'flex flex-row';

            this.linkInput = new ToCopyInput();

            this.flexContainer.appendChild(this.linkInput.el);
            this.el.appendChild(headerContainer);
            this.el.appendChild(this.flexContainer);
        }

        dispose() {
            if (this.keyInput) {
                this.keyInput.detachEl();
                delete this.keyInput;
            }

            this.linkInput.detachEl();
            delete this.linkInput;

            this.detachEl();
        }
    }

    class AlbumShareLinksList extends MComponent {
        /**
         * @param {String[]} albumIds Album ids to insert into the list
         * @param {Function} onDismiss Callback to fire when the list is not needed anymore
         */
        constructor(albumIds, onDismiss) {
            super();

            if (Array.isArray(albumIds) && albumIds.length) {
                this.albumIds = albumIds;
            }

            this.onDismiss = onDismiss;
        }

        /**
         * @param {String} albumIds The array of album ids to build links for
         */
        set albumIds(albumIds) {
            this.clearList();

            const { store } = scope.albums;
            const ids = albumIds.filter(id => store[id] && !store[id].filterFn);
            this.isMultiple = ids.length > 1;

            for (let i = 0; i < ids.length; i++) {
                this._shares.push(new AlbumShareLinkBlock(
                    this.el.firstElementChild,
                    ids[i],
                    this.isMultiple,
                    () => {
                        if (!this.isMultiple && typeof this.onDismiss === 'function') {
                            this.onDismiss();
                        }
                    }
                ));
            }

            this._keysSeparated = false;
            this.updateCopyButtons();
        }

        /**
         * @param {Boolean} status Either shares keys should be separated or not
         */
        set keysSeparated(status) {
            this._keysSeparated = status;

            for (let i = 0; i < this._shares.length; i++) {
                this._shares[i].keySeparated = status;
            }

            this.updateCopyButtons();
        }

        updateCopyButtons() {
            if (this.isMultiple) {
                const label = this._keysSeparated ? l[23625] : l[20840];

                if (!this.copyLinksBtn) {
                    const container = document.createElement('div');
                    container.className = 'flex flex-row justify-end pt-4 gap-4 px-12';

                    this.copyLinksBtn = new MButton(
                        label,
                        null,
                        () => {
                            copyToClipboard(
                                this._shares.map(s => s.linkString).join("\n"),
                                mega.icu.format(l.toast_copy_link, this._shares.length)
                            );
                        },
                        'mega-button positive copy current'
                    );

                    container.appendChild(this.copyLinksBtn.el);
                    this.el.appendChild(container);
                }
                else if (label !== this.copyLinksBtn.label) {
                    this.copyLinksBtn.label = label;
                }

                if (this._keysSeparated) {
                    if (!this.copyLinksBtn.el.nextElementSibling) {
                        this.copyKeysBtn = new MButton(
                            l[23624],
                            null,
                            () => {
                                copyToClipboard(
                                    this._shares.map(s => s.keyString).join("\n"),
                                    mega.icu.format(l.toast_copy_key, this._shares.length)
                                );
                            },
                            'mega-button positive copy current'
                        );

                        this.copyLinksBtn.el.insertAdjacentElement('afterend', this.copyKeysBtn.el);
                    }
                }
                else if (this.copyLinksBtn.el.nextElementSibling) {
                    this.copyLinksBtn.el.parentNode.removeChild(this.copyLinksBtn.el.nextElementSibling);
                }
            }
            else {
                this.clearCopyButtons();
            }
        }

        clearCopyButtons() {
            if (this.copyLinksBtn) {
                this.copyLinksBtn.detachEl();
                delete this.copyLinksBtn;

                if (this.copyKeysBtn) {
                    this.copyKeysBtn.detachEl();
                    delete this.copyKeysBtn;
                }
            }
        }

        buildElement() {
            this.el = document.createElement('div');

            const scrollable = document.createElement('div');
            scrollable.className = 'max-h-100 px-12 overflow-y-hidden';

            this.el.appendChild(scrollable);

            delay('share_dialog:apply_scrollable', () => {
                applyPs(scrollable);
            }, 100);
        }

        clearList() {
            if (Array.isArray(this._shares) && this._shares.length) {
                for (let i = 0; i < this._shares.length; i++) {
                    this._shares[i].dispose();
                }
            }

            this._shares = [];
            this.clearCopyButtons();
        }
    }

    class AlbumShareDialog extends MDialog {
        constructor(albumIds) {
            super({
                ok: false,
                cancel: false,
                dialogClasses: 'export-links-dialog'
            });

            this.setContent(albumIds);

            this.unsubscribeFromShare = mega.sets.subscribe('ass', 'albumsShare', ({ s }) => {
                if (albumIds.includes(s)) {
                    this.hide();
                }
            });
        }

        setContent(albumIds) {
            this.slot = document.createElement('div');
            this.title = mega.icu.format(l.album_share_link, albumIds.length);

            const divTop = document.createElement('div');
            divTop.className = 'pb-6 pt-2 px-12 flex flex-row';
            const divBottom = document.createElement('div');
            divBottom.className = 'py-6 bg-surface-grey-1';

            const checkbox = new MCheckbox({
                label: mega.icu.format(l.album_share_link_checkbox_label, albumIds.length),
                id: 'album-link-export',
                checked: false
            });

            const hint = new MHint({
                title: l[1028],
                text: mega.icu.format(l.export_link_decrypt_tip, albumIds.length),
                img: 'illustration sprite-fm-illustration img-dialog-decryption-key',
                link: 'https://help.mega.io/files-folders/sharing/encrypted-links',
                classes: 'icon-size-6 cursor-pointer mx-2'
            });

            this.list = new AlbumShareLinksList(
                albumIds,
                () => {
                    this.hide();
                }
            );

            checkbox.onChange = (checked) => {
                this.list.keysSeparated = checked;
            };

            divTop.appendChild(checkbox.el);
            divTop.appendChild(hint.el);
            divBottom.appendChild(this.list.el);

            this.slot.appendChild(divTop);
            this.slot.appendChild(divBottom);
        }

        hide() {
            this.list.clearList();
            this.list.detachEl();

            this.unsubscribeFromShare();
            super.hide();
        }
    }

    class AlbumItemsDialog extends TimelineDialog {
        constructor(albumId, keepEnabled) {
            super({
                ok: {
                    label: l.album_done,
                    callback: () => {
                        const album = scope.albums.store[albumId];
                        this.confirmed = true;

                        if (this.timeline && album) {
                            const handles = Object.keys(this.timeline.selections);

                            if (handles.length > 0) {
                                const existingHandles = {};
                                const handlesToAdd = [];

                                const { nodes, label, k } = album;
                                let addedCount = 0;

                                for (let i = 0; i < nodes.length; i++) {
                                    existingHandles[nodes[i].h] = true;

                                    if (scope.isVideo(nodes[i])) {
                                        this.currentVideosCount++;
                                    }
                                    else {
                                        this.currentImagesCount++;
                                    }
                                }

                                for (let i = 0; i < handles.length; i++) {
                                    const h = handles[i];

                                    if (!existingHandles[h]) {
                                        addedCount++;
                                        handlesToAdd.push({ h, o: (nodes.length + handlesToAdd.length + 1) * 1000 });

                                        if (M.d[h] && scope.isVideo(M.d[h])) {
                                            this.videosCount++;
                                        }
                                        else {
                                            this.imagesCount++;
                                        }
                                    }
                                }

                                if (addedCount > 0) {
                                    loadingDialog.show('MegaAlbumsAddItems');

                                    mega.sets.elements.bulkAdd(handlesToAdd, albumId, k)
                                        .then(() => {
                                            toaster.main.show({
                                                icons: ['sprite-fm-mono icon-check-circle text-color-medium'],
                                                content: mega.icu
                                                    .format(l.album_added_items_status, addedCount)
                                                    .replace('%s', limitNameLength(label))
                                            });

                                            if (M.isAlbumsPage(1)) {
                                                M.openFolder(`albums/${albumId}`);
                                            }
                                        })
                                        .catch(() => {
                                            console.error(`Cannot add items to album ${albumId}`);
                                        })
                                        .finally(() => {
                                            loadingDialog.hide('MegaAlbumsAddItems');
                                        });
                                }
                            }
                        }
                    }
                },
                cancel: true,
                dialogClasses: 'album-items-dialog',
                contentClasses: 'px-1',
                onclose: () => {
                    const seqEnd = Date.now();

                    if (timemarks.albumCreateNamed) {
                        delay(
                            'albums_stat_99828',
                            eventlog.bind(null, 99828, JSON.stringify({
                                videosCount: this.videosCount,
                                imagesCount: this.imagesCount,
                                start: timemarks.albumCreateStarted,
                                end: seqEnd,
                                lifetime: seqEnd - timemarks.albumCreateStarted
                            }))
                        );
                    }
                    else if (this.confirmed && (this.videosCount || this.imagesCount)) {
                        delay(
                            'albums_stat_99827',
                            eventlog.bind(null, 99827, JSON.stringify({
                                videosCount: this.videosCount,
                                imagesCount: this.imagesCount,
                                totalImagesCount: this.currentImagesCount + this.imagesCount,
                                totalVideosCount: this.currentVideosCount + this.videosCount,
                                start: timemarks.albumItemsSelectStarted,
                                end: seqEnd,
                                lifetime: seqEnd - timemarks.albumItemsSelectStarted
                            }))
                        );
                    }

                    timemarks.albumCreateNamed = 0;
                    timemarks.albumItemsSelectStarted = 0;
                    scope.reinitiateEvents();
                    delete $.timelineDialog;
                }
            });

            this.videosCount = 0;
            this.imagesCount = 0;
            this.currentVideosCount = 0;
            this.currentImagesCount = 0;
            this.confirmed = false;

            this.setContent(scope.albums.store[albumId].label);
            this.keepEnabled = keepEnabled;
            this._title.classList.add('text-center');
            this.albumId = albumId;
            $.timelineDialog = this;
        }

        setContent(albumName) {
            this.slot = document.createElement('div');
            this.slot.className = 'relative';
            this.title = l.add_items_to_album.replace('%s', albumName);
        }

        updateSelectedCount(count) {
            if (count) {
                this.actionTitle = mega.icu.format(l.selected_items_count, count);
                this.enable();
            }
            else {
                this.actionTitle = l.no_selected_items;

                if (!this.keepEnabled) {
                    this.disable();
                }
            }
        }

        onMDialogShown() {
            document.activeElement.blur();
            this.updateSelectedCount(0);

            if (scope.albums.grid && scope.albums.grid.timeline && scope.albums.grid.timeline.dragSelect) {
                scope.albums.grid.timeline.dragSelect.disabled = true;
            }

            this.timeline = new scope.AlbumTimeline({
                onSelectToggle: () => {
                    delay(
                        'timeline:update_selected_count',
                        () => {
                            this.updateSelectedCount(this.timeline.selCount);
                        },
                        50
                    );
                },
                containerClass: 'album-timeline-dialog px-2 py-1',
                sidePadding: 8,
                showMonthLabel: true,
                skipGlobalZoom: true,
                selectionLimit: scope.maxSelectionsCount
            });

            const cameraTree = MegaGallery.getCameraHandles();
            const galleryNodes = {
                all: [],
                cd: [],
                cu: []
            };

            for (let i = 0; i < M.v.length; i++) {
                const n = M.v[i];
                let isGalleryNode = false;

                // Checking if it is a gallery node and if is located specifically in CU or in CD
                if (scope.sections[scope.secKeys.cdphotos].filterFn(n, cameraTree)) {
                    galleryNodes.cd.push(n);
                    isGalleryNode = true;
                }

                else if (scope.sections[scope.secKeys.cuphotos].filterFn(n, cameraTree)) {
                    galleryNodes.cu.push(n);
                    isGalleryNode = true;
                }

                if (isGalleryNode) {
                    galleryNodes.all.push(n);
                }
            }

            if (galleryNodes.cu.length > 0 && galleryNodes.cd.length > 0) {
                const nav = new MTabs();
                nav.el.classList.add('locations-dialog-nav');

                nav.tabs = [
                    {
                        label: l.gallery_all_locations,
                        click: () => {
                            nav.activeTab = 0;
                            this.timeline.nodes = galleryNodes.all;
                        }
                    },
                    {
                        label: l.gallery_from_cloud_drive,
                        click: () => {
                            nav.activeTab = 1;
                            this.timeline.nodes = galleryNodes.cd;
                        }
                    },
                    {
                        label: l.gallery_camera_uploads,
                        click: () => {
                            nav.activeTab = 2;
                            this.timeline.nodes = galleryNodes.cu;
                        }
                    }
                ];

                nav.activeTab = 0;
                this.slot.appendChild(nav.el);
            }
            else {
                const div = document.createElement('div');
                div.className = 'text-center timeline-location';
                div.textContent = (galleryNodes.cu.length > 0)
                    ? l.on_camera_uploads
                    : l.on_cloud_drive;

                this.slot.appendChild(div);
            }

            this.slot.appendChild(this.timeline.el);

            delay('render:album_timeline', () => {
                if (this.timeline) {
                    this.timeline.nodes = galleryNodes.all;
                }
            });

            timemarks.albumItemsSelectStarted = Date.now();
            mBroadcaster.once('closedialog', scope.reinitiateEvents);
        }
    }

    class AlbumCoverDialog extends TimelineDialog {
        constructor(albumId) {
            super({
                ok: {
                    label: l.album_done,
                    callback: () => {
                        if (this.timeline && this.timeline.selCount) {
                            scope.albums.updateAlbumCover(
                                scope.albums.store[this.albumId],
                                Object.keys(this.timeline.selections)[0]
                            );
                        }
                    }
                },
                cancel: true,
                dialogClasses: 'album-items-dialog',
                contentClasses: 'px-1',
                onclose: () => {
                    scope.reinitiateEvents();
                    delete $.timelineDialog;
                }
            });

            this.setContent();
            this._title.classList.add('text-center');
            this.albumId = albumId;
            $.timelineDialog = this;
        }

        setContent() {
            this.slot = document.createElement('div');
            this.title = l.set_album_cover;
        }

        onMDialogShown() {
            let isLoaded = false;

            if (scope.albums.grid && scope.albums.grid.timeline && scope.albums.grid.timeline.dragSelect) {
                scope.albums.grid.timeline.dragSelect.disabled = true;
            }

            this.timeline = new scope.AlbumTimeline({
                onSelectToggle: () => {
                    delay('album:cover_update', () => {
                        if (this.timeline.selCount === 1 && isLoaded) {
                            this.enable();
                        }
                        else {
                            isLoaded = true;
                            this.disable();
                        }
                    }, 100);
                },
                containerClass: 'album-timeline-dialog px-2 py-1',
                sidePadding: 8,
                showMonthLabel: false,
                skipGlobalZoom: true,
                selectionLimit: 1
            });

            const { nodes, eIds, at: { c } } = scope.albums.store[this.albumId];

            if (nodes && nodes.length) {
                this.timeline.selectNode(
                    (c && eIds[c] && M.d[eIds[c]] && M.getNodeRoot(M.d[eIds[c]].p) !== M.RubbishID)
                        ? M.d[eIds[c]]
                        : nodes[0]
                );
            }

            this.slot.appendChild(this.timeline.el);

            delay('render:album_timeline', () => {
                if (this.timeline) {
                    this.timeline.nodes = nodes;
                }
            });

            mBroadcaster.once('closedialog', scope.reinitiateEvents);

            this.disable();
        }
    }

    class RemoveAlbumDialog extends MDialog {
        /**
         * @param {String[]} albumIds The IDs array for albums to be removed
         */
        constructor(albumIds) {
            const isMultiple = albumIds.length > 1;

            super({
                ok: {
                    label: (isMultiple) ? l.delete_albums_confirmation : l.delete_album_confirmation,
                    callback: () => {
                        let albumLabel = '';

                        const promises = [];
                        const stats = { count: getAlbumsCount() };

                        for (let i = 0; i < albumIds.length; i++) {
                            const albumId = albumIds[i];
                            const album = scope.albums.store[albumId];

                            if (!album || album.filterFn) {
                                return;
                            }

                            if (!albumLabel) {
                                albumLabel = album.label;
                            }

                            if (pendingName && album.label === pendingName) {
                                pendingName = '';
                            }

                            loadingDialog.show('AlbumRemoval');

                            promises.push(
                                mega.sets.remove(album.id)
                                    .then((res) => {
                                        delay(
                                            'albums_stat_99916_' + album.id,
                                            eventlog.bind(null, 99916, JSON.stringify({
                                                elCount: album.nodes.length,
                                                albumCount: --stats.count,
                                            }))
                                        );

                                        return Promise.resolve(res);
                                    })
                                    .catch(() => {
                                        console.error(`Could not remove album ${album.id}...`);
                                    })
                            );
                        }

                        Promise.all(promises)
                            .then(() => {
                                let toastText = mega.icu.format(l.albums_removed_status, albumIds.length);

                                if (!isMultiple) {
                                    toastText = toastText.replace('%s', limitNameLength(albumLabel));
                                }

                                const content = generateToastContent(toastText);

                                toaster.main.show({
                                    icons: ['sprite-fm-mono icon-bin text-color-medium'],
                                    content
                                });
                            })
                            .finally(() => {
                                loadingDialog.hide('AlbumRemoval');
                            });
                    },
                    classes: ['mega-button', 'branded-red']
                },
                cancel: true,
                dialogClasses: null,
                leftIcon: 'warning sprite-fm-uni icon-warning icon-size-16'
            });

            this.setContent(isMultiple);
        }

        setContent(isMultiple) {
            const p = document.createElement('p');
            p.className = 'px-6';

            p.textContent = (isMultiple) ? l.delete_albums_dialog_body : l.delete_album_dialog_body;

            this.slot = p;
            this.title = (isMultiple) ? l.delete_albums_dialog_title : l.delete_album_dialog_title;
        }
    }

    class RemoveAlbumItemsDialog extends MDialog {
        constructor(handles) {
            super({
                ok: {
                    label: l.remove_album_elements_btn,
                    callback: () => {
                        scope.albums.removeElementsByHandles(handles);
                    },
                    classes: ['mega-button', 'branded-red']
                },
                cancel: {
                    label: l.remove_album_elements_cancel
                },
                dialogClasses: null,
                leftIcon: 'warning sprite-fm-uni icon-warning icon-size-16'
            });

            this.setContent(handles);
        }

        setContent(handles) {
            const p = document.createElement('p');
            p.className = 'px-6';

            p.textContent = mega.icu.format(l.remove_album_elements_text, handles.length);

            this.slot = p;
            this.title = mega.icu.format(l.remove_album_elements_title, handles.length);
        }
    }

    class AlbumNameDialog extends MDialog {
        constructor(albumId, okFn, closeFn) {
            super({
                ok: {
                    label: albumId ? l.album_rename_btn_label : l.album_create_btn_label,
                    callback: () => {
                        const { value } = this.input;
                        const { err, isDisabled } = this.validateInput(albumId);

                        if (mega.sets && !err && !isDisabled) {
                            this.okBtn.loading = true;

                            if (okFn) {
                                okFn(value);
                            }
                            else if (albumId) {
                                mega.sets.updateAttrValue(
                                    {
                                        at: scope.albums.store[albumId].at,
                                        k: scope.albums.store[albumId].k,
                                        id: albumId
                                    },
                                    'n',
                                    value
                                ).then(() => {
                                    const album = scope.albums.store[albumId];

                                    if (album) {
                                        album.label = value;

                                        if (album.cellEl) {
                                            album.cellEl.updateName();
                                        }

                                        if (album.button) {
                                            album.button.label = value;
                                        }
                                    }

                                    this.hide();
                                }).catch(() => {
                                    this.okBtn.loading = false;
                                    // Show an error?
                                });
                            }
                            else {
                                scope.albums.tree.setPendingButton(value);
                                scope.albums.grid.setPendingCell(value);
                                pendingName = value;

                                timemarks.albumCreateNamed = Date.now();

                                delay(
                                    'albums_stat_99826',
                                    eventlog.bind(null, 99826, JSON.stringify({
                                        albumsCount: getAlbumsCount() + 1,
                                        start: timemarks.albumCreateStarted,
                                        end: timemarks.albumCreateNamed,
                                        lifetime: timemarks.albumCreateNamed - timemarks.albumCreateStarted
                                    }))
                                );

                                mega.sets.add(value)
                                    .then(() => {
                                        this.hide();
                                    })
                                    .catch(() => {
                                        // Show an error?
                                        this.okBtn.loading = false;
                                    });
                            }
                        }

                        return false;
                    }
                },
                cancel: true,
                dialogClasses: 'create-folder-dialog',
                contentClasses: 'px-2',
                onclose: () => {
                    scope.reinitiateEvents();

                    if (closeFn) {
                        queueMicrotask(closeFn);
                    }
                }
            });

            this.albumId = albumId;
            this.setContent(albumId);

            this.disposeInputListener = MComponent.listen(this.input, 'input', () => {
                this.triggerInputSaveguard();
            });
            this._title.classList.add('text-center');

            scope.albums.removeKeyboardListener();

            if (!albumId) {
                timemarks.albumCreateStarted = Date.now();
            }
            mBroadcaster.once('closedialog', scope.reinitiateEvents);
        }

        triggerInputSaveguard() {
            const { err, warn, isDisabled } = this.validateInput(this.albumId);

            if (err) {
                this.disable();
                this.showError(err);
            }
            else if (isDisabled) {
                this.disable();
            }
            else {
                this.enable();
            }

            if (!err && warn) {
                this.showWarning(warn);
            }

            if (!err && !warn) {
                this.clearHint();
            }
        }

        setNames(names) {
            this.existingNames = names;
        }

        setContent(albumId) {
            this.slot = document.createElement('div');
            this.slot.className = 'px-6';

            const div = document.createElement('div');
            div.className = 'create-album-input-bl';

            const inputIcon = document.createElement('i');
            inputIcon.className = 'sprite-fm-mono icon-album icon-size-6';

            this.input = document.createElement('input');
            this.input.setAttribute('placeholder', 'Album name');
            this.input.setAttribute('autofocus', '');
            this.input.setAttribute('type', 'text');

            if (albumId && scope.albums.store[albumId]) {
                this.input.value = scope.albums.store[albumId].label;
                this.title = l.edit_album_name;
            }
            else {
                const name = proposeAlbumName();

                this.title = l.enter_album_name;
                this.input.value = name;

                if (!name) {
                    this.disable();
                }
            }

            div.appendChild(inputIcon);
            div.appendChild(this.input);
            this.slot.appendChild(div);
        }

        validateInput(albumId) {
            const { value } = this.input;

            const validation = {
                isDisabled: false,
                err: null,
                warn: null
            };


            if (!value
                || typeof value !== 'string'
                || value.trim() === ''
                || typeof albumId === 'string' && value === scope.albums.store[albumId].label) {
                validation.isDisabled = true;
            }

            // Cases for errors
            switch (true) {
                case value.length > 250:
                    validation.err = l.album_name_too_long;
                    break;
                case value.trim().length && !M.isSafeName(value):
                    validation.err = l[24708];
                    break;
                case isSystemAlbumName(value):
                    validation.err = l.album_name_not_allowed;
                    break;
                case (this.existingNames && this.existingNames[value]) || albumNameExists(value, albumId):
                    validation.err = l.album_name_exists;
                    break;
                case pfcol && scope.takenNames && scope.takenNames[value]:
                    validation.err = l.album_exists_in_account.replace('%s', value);
                    break;
                default: break;
            }

            if (value.length !== value.trim().length) {
                validation.warn = l.album_name_contains_extra_spaces;
            }

            return validation;
        }

        showHint(text, className) {
            if (!this.hint) {
                this.hint = document.createElement('div');
                this.slot.appendChild(this.hint);
            }

            this.hint.className = className;
            this.hint.textContent = text;
        }

        showError(err) {
            this.input.classList.add('error');
            this.showHint(err, 'duplicated-input-warning');
            $('.create-album-input-bl').addClass('duplicated');
        }

        showWarning(warn) {
            this.showHint(warn, 'whitespaces-input-warning');
        }

        clearHint() {
            this.input.classList.remove('error');
            $('.create-album-input-bl').removeClass('duplicated');

            if (this.hint) {
                this.slot.removeChild(this.hint);
                delete this.hint;
            }
        }

        onMDialogShown() {
            this.triggerInputSaveguard();

            delay('focus:new_album_input', () => {
                this.input.focus();
                this.input.select();
            }, 200);
        }

        hide() {
            super.hide();
            this.disposeInputListener();
        }
    }

    Object.defineProperty(AlbumNameDialog, 'prompt', {
        value(albumId, names) {
            return new Promise((resolve) => {
                const dialog = new AlbumNameDialog(
                    albumId,
                    (name) => {
                        dialog.hide();
                        return resolve(name);
                    },
                    () => resolve(null)
                );

                if (names) {
                    dialog.setNames(names);
                }

                dialog.show();
            });
        }
    });

    class NoMediaForAlbums extends MEmptyPad {
        constructor() {
            super();
            this.setContents();
        }

        setContents() {
            this.el.appendChild(MEmptyPad.createIcon('section-icon sprite-fm-theme icon-gallery-photos'));
            this.el.appendChild(MEmptyPad.createTxt(l.album_no_media, 'fm-empty-cloud-txt empty-albums-title'));
            this.el.appendChild(MEmptyPad.createTxt(l.empty_album_subtitle, 'fm-empty-description'));

            this.appendOptions([
                [l.empty_album_instruction_1, 'sprite-fm-mono icon-camera-uploads'],
                [l.empty_album_instruction_2, 'sprite-fm-mono icon-mobile'],
                [l.empty_album_instruction_3, 'sprite-fm-mono icon-pc']
            ]);
        }
    }

    class NoMediaNoAlbums extends MEmptyPad {
        constructor() {
            super();
            this.setContents();
        }

        setContents() {
            this.el.appendChild(MEmptyPad.createIcon('section-icon sprite-fm-theme icon-gallery-photos'));
            this.el.appendChild(MEmptyPad.createTxt(l.no_albums, 'fm-empty-cloud-txt empty-albums-title'));
            this.el.appendChild(MEmptyPad.createTxt(l.gallery_get_start, 'fm-empty-description'));

            this.appendOptions([
                [l.empty_album_instruction_1, 'sprite-fm-mono icon-camera-uploads'],
                [l.empty_album_instruction_2, 'sprite-fm-mono icon-mobile'],
                [l.empty_album_instruction_3, 'sprite-fm-mono icon-pc']
            ]);
        }
    }

    class AlbumsEmpty {
        constructor(title, btnLabel, buttonFn) {
            this.el = document.createElement('div');
            this.el.className = 'text-center flex flex-column justify-center empty-albums-section';

            this.setContents(title, btnLabel, buttonFn);
        }

        setContents(title, btnLabel, buttonFn) {
            const icon = document.createElement('i');
            icon.className = 'sprite-fm-theme icon-gallery-photos';

            const titleEl = document.createElement('div');
            titleEl.className = 'fm-empty-cloud-txt empty-albums-title';
            titleEl.textContent = title;

            this.el.appendChild(icon);
            this.el.appendChild(titleEl);

            if (!btnLabel) {
                return;
            }

            const button = new MButton(
                btnLabel,
                null,
                buttonFn,
                'mega-button large positive'
            );
            this.el.appendChild(button.el);
        }
    }

    class MultipleAlbumsContextMenu extends MMenuSelect {
        constructor(domCells) {
            super();

            const options = [];
            const albums = [];
            let somePredefined = false;
            let someContainNodes = false;
            let sharedCount = 0;
            let allShared = true;

            for (let i = 0; i < domCells.length; i++) {
                const { album } = domCells[i];

                if (!somePredefined && album.filterFn) {
                    somePredefined = true;
                }

                if (!someContainNodes && album.nodes.length > 0) {
                    someContainNodes = true;
                }

                if (album.p) {
                    sharedCount++;
                }

                if (allShared && !album.p) {
                    allShared = false;
                }

                albums.push(album);
            }

            if (!somePredefined) {
                if (allShared) {
                    options.push(
                        {
                            label: l[17520],
                            icon: 'link',
                            click: () => {
                                const albumIds = [];

                                for (let i = 0; i < albums.length; i++) {
                                    const { p, id } = albums[i];

                                    if (p) {
                                        albumIds.push(id);
                                    }
                                }

                                const dialog = new AlbumShareDialog(albumIds);
                                dialog.show();
                            }
                        }
                    );
                }
                else {
                    options.push({
                        label: mega.icu.format(l.album_share_link, albums.length),
                        icon: 'link',
                        click: () => {
                            scope.albums.addShare(albums.map(({ id }) => id));
                        }
                    });
                }

                if (sharedCount) {
                    options.push({
                        label: (sharedCount > 1) ? l[8735] : l[6821],
                        icon: 'link-remove',
                        click: () => {
                            const albumIds = [];

                            for (let i = 0; i < albums.length; i++) {
                                const { p, id } = albums[i];

                                if (p) {
                                    albumIds.push(id);
                                }
                            }

                            if (albumIds.length) {
                                removeShareWithConfirmation(albumIds);
                            }
                        }
                    });
                }

                if (someContainNodes) {
                    options.push({});
                }
            }

            if (someContainNodes) {
                options.push(generateDownloadMenuItem(albums.map(({ id }) => id)));
            }

            if (!somePredefined) {
                options.push(
                    {},
                    {
                        label: l.delete_album,
                        click: () => {
                            const dialog = new RemoveAlbumDialog(albums.map(({ id }) => id));
                            dialog.show();
                            this.hide();
                        },
                        icon: 'bin',
                        classes: ['red']
                    }
                );
            }

            this.options = options;
        }
    }

    class AlbumOptionsContextMenu extends MMenuSelect {
        constructor(options) {
            super();
            this.options = options;
        }
    }

    class AlbumContextMenu extends MMenuSelect {
        constructor(albumId, isPublic) {
            super();

            const options = [];
            const { nodes, p, filterFn } = scope.albums.store[albumId];
            const isUserAlbum = !filterFn;

            if (scope.nodesAllowSlideshow(nodes)) {
                options.push({
                    label: l.album_play_slideshow,
                    icon: 'play-square',
                    click: () => {
                        if (scope.albums.grid && scope.albums.grid.timeline) {
                            scope.albums.grid.timeline.clearSiblingSelections();
                        }

                        $.selected = [];
                        scope.playSlideshow(albumId, true);
                    }
                });
            }

            if (isPublic) {
                if (nodes.length) {
                    options.push(
                        {},
                        generateDownloadMenuItem([albumId]),
                        {},
                        {
                            label: (u_type) ? l.context_menu_import : l.btn_imptomega,
                            icon: (u_type) ? 'upload-to-cloud-drive' : 'mega-thin-outline',
                            click: () => {
                                eventlog(99831);
                                M.importFolderLinkNodes([M.RootID]);
                            }
                        }
                    );
                }
            }
            else {
                if (M.currentdirid !== `albums/${albumId}`) {
                    options.push(
                        {
                            label: l.album_open,
                            icon: 'preview-reveal',
                            click: () => {
                                M.openFolder(`albums/${albumId}`);
                            }
                        }
                    );
                }

                if (isUserAlbum) {
                    if (M.v.length) {
                        options.push(
                            {},
                            {
                                label: l.add_album_items,
                                icon: 'add',
                                click: () => {
                                    const dialog = new AlbumItemsDialog(albumId);
                                    dialog.show();
                                }
                            },
                            {}
                        );
                    }

                    if (p) {
                        options.push(
                            {
                                label: l[6909],
                                icon: 'link',
                                click: () => {
                                    // The share has changed already, ignoring
                                    if (!scope.albums.store[albumId].p) {
                                        return;
                                    }

                                    const dialog = new AlbumShareDialog([albumId]);
                                    dialog.show();
                                }
                            },
                            {
                                label: l[6821],
                                icon: 'link-remove',
                                click: () => {
                                    removeShareWithConfirmation([albumId]);
                                }
                            }
                        );
                    }
                    else {
                        options.push({
                            label: mega.icu.format(l.album_share_link, 1),
                            icon: 'link',
                            click: () => {
                                // The share has changed already, ignoring
                                if (scope.albums.store[albumId].p) {
                                    return;
                                }

                                scope.albums.addShare([albumId]);
                            }
                        });
                    }

                    options.push({});

                    if (nodes.length) {
                        options.push(
                            generateDownloadMenuItem([albumId]),
                            {
                                label: l.set_album_cover,
                                icon: 'images',
                                click: () => {
                                    const dialog = new AlbumCoverDialog(albumId);
                                    dialog.show();
                                }
                            }
                        );
                    }

                    options.push(
                        {
                            label: l.rename_album,
                            click: () => {
                                const dialog = new AlbumNameDialog(albumId);
                                dialog.show();
                            },
                            icon: 'rename'
                        },
                        {},
                        {
                            label: l.delete_album,
                            click: () => {
                                const dialog = new RemoveAlbumDialog([albumId]);
                                dialog.show();
                                this.hide();
                            },
                            icon: 'bin',
                            classes: ['red']
                        }
                    );
                }
                else {
                    options.push(
                        {},
                        generateDownloadMenuItem([albumId])
                    );
                }
            }

            this.options = options;

            this.unsubscribeFromShare = mega.sets.subscribe('ass', 'albumsShare', () => {
                this.hide();
            });
        }

        hide() {
            this.unsubscribeFromShare();
            super.hide();
        }
    }

    class AlbumCell extends MComponent {
        constructor(albumId) {
            super();

            this.el.album = scope.albums.store[albumId];
            this.el.album.setThumb = (dataUrl, fa) => {
                if (M.isAlbumsPage(1)) {
                    this.setThumb(dataUrl, fa);
                }
            };

            this.attachEvent('click', (evt) => {
                const resetSelections = !scope.getCtrlKeyStatus(evt) && !evt.shiftKey;
                scope.albums.grid.lastSelected = this.el;

                this.selectCell(resetSelections);

                if (evt.shiftKey) {
                    const albums = Object.values(scope.albums.store).filter(album => albumIsRenderable(album));

                    const index = albums.findIndex(({ cellEl }) => cellEl.el === this.el);
                    let shiftSelIndex = albums.findIndex(({ cellEl }) => cellEl.el === scope.albums.grid.shiftSelected);

                    if (shiftSelIndex < 0) {
                        shiftSelIndex = index;
                    }

                    const arr = [index, shiftSelIndex];
                    arr.sort((a, b) => a - b);

                    const [min, max] = arr;

                    for (let i = 0; i < albums.length; i++) {
                        if (i >= min && i <= max) {
                            albums[i].cellEl.selectCell();
                        }
                        else {
                            albums[i].cellEl.deselectCell();
                        }
                    }
                }

                evt.stopPropagation();
                evt.preventDefault();
            });

            this.attachEvent(
                'dblclick',
                () => {
                    M.openFolder('albums/' + albumId);
                }
            );

            this.attachEvent(
                'contextmenu',
                ({ pageX, pageY }) => {
                    if (!$.dialog) {
                        this.selectCell(!this.el.classList.contains('ui-selected'));

                        const selectedCells = this.el.parentNode.querySelectorAll('.ui-selected');

                        const contextMenu = (selectedCells.length > 1)
                            ? new MultipleAlbumsContextMenu(selectedCells)
                            : new AlbumContextMenu(albumId);

                        if (contextMenu.options) {
                            contextMenu.show(pageX, pageY);
                        }
                    }
                }
            );

            this.isShared = !!this.el.album.p;
        }

        get isShared() {
            return !!this.shareIcon;
        }

        /**
         * @param {Boolean} value Shared status
         */
        set isShared(value) {
            if (value === this.isShared) {
                return;
            }

            if (value) {
                this.shareIcon = document.createElement('i');
                this.shareIcon.className = 'sprite-fm-mono icon-link pointer-events-none icon-size-6';
                this.el.appendChild(this.shareIcon);
            }
            else {
                this.el.removeChild(this.shareIcon);
                delete this.shareIcon;
            }
        }

        buildElement() {
            this.el = document.createElement('div');
            this.el.className = 'albums-grid-cell flex flex-column justify-end cursor-pointer';
            scope.setShimmering(this.el);
        }

        selectCell(clearSiblingSelections) {
            if (!this.el.classList.contains('ui-selected')) {
                this.el.classList.add('ui-selected');
            }

            if (clearSiblingSelections) {
                AlbumCell.clearSiblingSelections(this.el);
            }
        }

        deselectCell() {
            if (this.el.classList.contains('ui-selected')) {
                this.el.classList.remove('ui-selected');
            }
        }

        setThumb(dataUrl, fa) {
            // The album cover might change, when editing multiple nodes at once,
            // so need to check if the thumb is still applicable
            if (this.el.album.node && this.el.album.node.fa === fa && fa !== this.coverFa) {
                this.el.style.backgroundImage = 'url(\'' + dataUrl + '\')';
                this.el.style.backgroundColor = 'white';
                this.coverFa = fa;
                scope.unsetShimmering(this.el);
            }
        }

        updateCoverImage() {
            if (this.el.album.node) {
                MegaGallery.addThumbnails([this.el.album]);
            }
            else {
                this.dropBackground();
            }
        }

        dropBackground() {
            this.el.style.backgroundImage = null;
            this.el.style.backgroundColor = null;
            this.coverFa = '';
        }

        updateName() {
            const titleEl = this.el.querySelector('.album-label');

            if (titleEl) {
                titleEl.textContent = this.el.album.label;
                titleEl.title = this.el.album.label;
            }
        }

        updatePlaceholders() {
            const count = this.el.album.nodes.length;

            const isPlaceholder = this.el.classList.contains('album-placeholder');
            this.countEl.textContent = count ? mega.icu.format(l.album_items_count, count) : l.album_empty;

            if (isPlaceholder) {
                if (count) {
                    this.el.classList.remove('album-placeholder');
                    this.el.removeChild(this.el.firstChild);
                }
            }
            else if (!count) {
                this.el.classList.add('album-placeholder');

                const placeholder = document.createElement('div');
                placeholder.className = 'flex flex-1 flex-row flex-center';

                const icon = document.createElement('i');
                icon.className = 'sprite-fm-mono icon-album';

                placeholder.appendChild(icon);
                this.el.prepend(placeholder);
            }
        }

        static clearSiblingSelections(ignoreEl) {
            const albums = Object.values(scope.albums.store);

            for (let i = 0; i < albums.length; i++) {
                if (albums[i].cellEl && (!ignoreEl || albums[i].cellEl.el !== ignoreEl)) {
                    albums[i].cellEl.el.classList.remove('ui-selected');
                }
            }
        }
    }

    /**
     * Creates a header for the Album(s) grid
     * @class
     */
    class AlbumsGridHeader {
        constructor(parent) {
            /**
             * @type {HTMLElement?}
             */
            this.breadcrumbs = null;

            /**
             * @type {HTMLElement?}
             */
            this.rightButtons = null;

            if (!parent) {
                return;
            }

            this.el = document.createElement('div');
            this.el.className = 'albums-header flex flex-row items-center justify-between';

            parent.appendChild(this.el);
            parent.classList.remove('hidden');

            this.setBreadcrumbs();

        }

        setBreadcrumbs(albumId) {
            if (this.breadcrumbs) {
                this.el.removeChild(this.breadcrumbs);
            }

            this.breadcrumbs = document.createElement('div');

            const span = document.createElement('span');

            if (albumId && scope.albums.store[albumId]) {
                const div = document.createElement('div');

                span.title = scope.albums.store[albumId].label;
                span.textContent = span.title;
                span.className = 'text-ellipsis ml-3 text-color-high';

                if (!scope.albums.isPublic) {
                    const btn = new MButton(
                        '',
                        'icon-next-arrow rot-180',
                        () => {
                            openMainPage();
                        },
                        'mega-button breadcrumb-btn action'
                    );

                    btn.el.title = l[822];
                    div.appendChild(btn.el);
                }

                this.breadcrumbs.appendChild(div);
                this.breadcrumbs.appendChild(span);
                this.breadcrumbs.className = 'flex flex-row items-center text-ellipsis';
            }
            else {
                span.textContent = l.albums;
                span.className = 'ml-3 text-color-high font-body-1';
                this.breadcrumbs.prepend(span);

                const i = document.createElement('i');
                i.className = 'sprite-fm-mono icon-album icon-blue icon-size-6';
                this.breadcrumbs.prepend(i);
                this.breadcrumbs.className = 'flex flex-row justify-center items-center';
            }

            this.el.prepend(this.breadcrumbs);
        }

        setBreadcrumbsTitle(albumId) {
            if (!this.breadcrumbs) {
                this.setBreadcrumbs(albumId);
                return;
            }

            const span = this.breadcrumbs.querySelector('span');

            span.title = scope.albums.store[albumId].label;
            span.textContent = span.title;
        }

        setSpecificAlbumButtons(albumId) {
            if (!scope.albums.store[albumId]) {
                return;
            }

            const { nodes, filterFn, p } = scope.albums.store[albumId];

            const nodesAvailable = !!nodes.length;
            const buttons = [];
            const needSlideshow = scope.nodesAllowSlideshow(nodes);

            if (scope.albums.isPublic) {
                if (needSlideshow) {
                    buttons.push([
                        l.album_play_slideshow,
                        'play-square icon-blue',
                        () => {
                            scope.albums.grid.timeline.clearSiblingSelections();
                            $.selected = [];
                            scope.playSlideshow(albumId, true);
                        },
                        this.rightButtons
                    ]);
                }
            }
            else {
                if (!filterFn) {
                    buttons.push(
                        [
                            l.add_album_items,
                            'add icon-green',
                            () => {
                                const dialog = new AlbumItemsDialog(albumId);
                                dialog.show();
                            },
                            this.rightButtons,
                            !M.v.length
                        ],
                        [
                            p ? l[6909] : mega.icu.format(l.album_share_link, 1),
                            'link icon-yellow',
                            () => {
                                const newP = scope.albums.store[albumId].p;

                                // The share has changed already, ignoring
                                if (!!p !== !!newP) {
                                    return;
                                }

                                if (p) {
                                    const dialog = new AlbumShareDialog([albumId]);
                                    dialog.show();
                                }
                                else {
                                    scope.albums.addShare([albumId]);
                                }
                            },
                            this.rightButtons,
                            !M.v.length
                        ]
                    );
                }

                if (needSlideshow) {
                    buttons.push([
                        l.album_play_slideshow,
                        'play-square icon-blue',
                        () => {
                            scope.playSlideshow(albumId, true);
                        },
                        this.rightButtons
                    ]);
                }

                if (nodesAvailable) {
                    buttons.push([
                        l.album_download,
                        'download-small icon-blue',
                        (component) => {
                            if (component) {
                                const { x, bottom } = component.el.getBoundingClientRect();
                                const menu = new DownloadContextMenu(albumId);

                                menu.show(x, bottom + 4);
                            }
                            else {
                                const handles = scope.getAlbumsHandles([albumId]);

                                if (handles.length) {
                                    scope.reportDownload();
                                    M.addDownload(handles);
                                }
                            }
                        },
                        this.rightButtons,
                        false,
                        (isMSync()) ? undefined : generateDownloadOptions([albumId])
                    ]);
                }

                if (p) {
                    buttons.push([
                        l[6821],
                        'link-remove',
                        () => {
                            removeShareWithConfirmation([albumId]);
                        },
                        this.rightButtons
                    ]);
                }

                if (!filterFn) {
                    buttons.push(
                        [
                            l.rename_album,
                            'rename',
                            () => {
                                const dialog = new AlbumNameDialog(albumId);
                                dialog.show();
                            },
                            this.rightButtons
                        ],
                        [
                            l.delete_album,
                            'bin',
                            () => {
                                const dialog = new RemoveAlbumDialog([albumId]);
                                dialog.show();
                            },
                            this.rightButtons,
                            false,
                            undefined,
                            ['red']
                        ]
                    );
                }
            }

            for (let i = 0; i < headerBtnLimit; i++) {
                if (buttons[i]) {
                    AlbumsGridHeader.attachButton(...buttons[i]);
                }
            }

            if (buttons.length > headerBtnLimit) {
                const optionsBtn = AlbumsGridHeader.attachButton(
                    l.album_options_more,
                    'options',
                    () => {
                        const contextMenu = new AlbumOptionsContextMenu(
                            buttons.slice(headerBtnLimit).map(([
                                label,
                                icon,
                                click,
                                parent,
                                isDisabled,
                                children,
                                classes
                            ]) => {
                                return {
                                    label,
                                    click,
                                    icon: icon.replace('icon-blue', ''),
                                    children,
                                    parent,
                                    isDisabled,
                                    classes
                                };
                            })
                        );

                        const { x, y, right, bottom } = optionsBtn.el.getBoundingClientRect();
                        contextMenu.show(x, bottom + MContextMenu.offsetVert, right, y + MContextMenu.offsetVert);
                    },
                    this.rightButtons,
                    !M.v.length
                );
            }
        }

        setGlobalButtons() {
            AlbumsGridHeader.attachButton(
                l.new_album,
                'add icon-green',
                () => {
                    const dialog = new AlbumNameDialog();
                    dialog.show();
                },
                this.rightButtons
            );
        }

        update(albumId) {
            this.setRightControls(albumId);
            this.setBreadcrumbs(albumId);

            // Only 'Albums' section needs this. Otherwise the banner does not appear in albums
            $('.fm-right-files-block').addClass('visible-notification');
        }

        setRightControls(albumId) {
            if (this.rightButtons) {
                while (this.rightButtons.firstChild) {
                    this.rightButtons.removeChild(this.rightButtons.firstChild);
                }
            }
            else {
                this.rightButtons = document.createElement('div');
                this.rightButtons.className = 'flex flex-row';
                this.el.appendChild(this.rightButtons);
            }

            if (albumId) {
                this.setSpecificAlbumButtons(albumId);
            }
            else {
                this.setGlobalButtons();
            }
        }
    }

    AlbumsGridHeader.attachButton = (label, icon, clickFn, parent, isDisabled) => {
        const button = new MButton(
            label,
            `icon-${icon}`,
            clickFn,
            'mega-button action ml-5'
        );

        if (parent) {
            parent.appendChild(button.el);
        }

        if (isDisabled) {
            button.el.disabled = true;
            button.el.classList.add('disabled');
        }

        return button;
    };

    /**
     * Creates a grid of available albums
     * @class
     */
    class AlbumsGrid {
        constructor() {
            /**
             * @type {AlbumsGridHeader?}
             */
            this.header = null;
            this.emptyBlock = null;
        }

        initLayout() {
            loadingDialog.hide('MegaGallery');

            // Checking if layout has already been initialised
            if (this.header) {
                return;
            }

            const parent = document.getElementById('albums-view');

            this.header = new AlbumsGridHeader(parent);
            this.el = document.createElement('div');
            this.el.className = 'albums-grid justify-center ps-ignore-keys';

            parent.appendChild(this.el);
        }

        setPendingCell(label) {
            this.pendingCell = document.createElement('div');
            this.pendingCell.className = 'albums-grid-cell flex flex-column justify-end album-placeholder pending-cell';
            const subdiv = document.createElement('div');
            const labelEl = document.createElement('div');
            labelEl.className = 'album-label';
            labelEl.textContent = label;
            const captionEl = document.createElement('div');
            captionEl.textContent = l.album_name_creating;

            subdiv.appendChild(labelEl);
            subdiv.appendChild(captionEl);
            this.pendingCell.appendChild(subdiv);

            const firstUserAlbum = getFirstUserAlbum();

            if (firstUserAlbum) {
                this.el.insertBefore(this.pendingCell, firstUserAlbum.cellEl.el);
            }
            else {
                this.el.appendChild(this.pendingCell);
            }

            this.updateGridState(
                Object.values(scope.albums.store).filter(album => albumIsRenderable(album)).length + 1
            );
            this.el.scrollTop = 0;
        }

        clearPendingCell() {
            if (this.pendingCell) {
                this.el.removeChild(this.pendingCell);
                delete this.pendingCell;
            }
        }

        addSkeletonCells(albums) {
            for (let i = 0; i < albums.length; i++) {
                const { label, nodes } = albums[i];
                const cell = document.createElement('div');

                cell.className = 'albums-grid-cell flex flex-column justify-end shimmer';
                const subdiv = document.createElement('div');
                const labelEl = document.createElement('div');
                labelEl.className = 'album-label';
                labelEl.textContent = label;
                const captionEl = document.createElement('div');
                captionEl.textContent = mega.icu.format(l.album_items_count, nodes.length);

                subdiv.appendChild(labelEl);
                subdiv.appendChild(captionEl);
                cell.appendChild(subdiv);

                this.el.appendChild(cell);
            }

            this.updateGridState(albums.length);
            this.el.scrollTop = 0;
        }

        showEmptyAlbumPage(albumId) {
            if (this.timeline) {
                this.timeline.clear();
                delete this.timeline;
            }

            let mvLength = M.v.length;
            if (slideshowid) {
                mvLength = tmpMv.length - (previewMvLength - M.v.length);
            }

            if (scope.albums.isPublic) {
                this.updateGridState(0, false);
                this.addEmptyBlock(new AlbumsEmpty(l.public_album_empty_title));
            }
            else if (mvLength) {
                this.updateGridState(0, false);

                this.addEmptyBlock(new AlbumsEmpty(
                    l.album_no_media,
                    l.add_album_items,
                    () => {
                        const dialog = new AlbumItemsDialog(albumId);
                        dialog.show();
                    }
                ));
            }
            else {
                this.updateGridState(0, false);
                this.addEmptyBlock(new NoMediaForAlbums());
            }
        }

        showAlbumContents(albumId) {
            const album = scope.albums.store[albumId];

            if (!album || !album.nodes || !album.nodes.length) {
                scope.albums.removeKeyboardListener();

                if (this.dragSelect) {
                    this.dragSelect.dispose();
                }

                this.showEmptyAlbumPage(albumId);
                return;
            }

            this.removeEmptyBlock();

            let prevCount = 0;

            this.timeline = new scope.AlbumTimeline({
                onSelectToggle: () => {
                    delay(
                        'timeline:update_selected_count',
                        () => {
                            if (!this.timeline) {
                                window.selectionManager.hideSelectionBar();
                                return;
                            }

                            if (this.timeline.selCount) {
                                window.selectionManager.showSelectionBar(
                                    mega.icu.format(l.album_selected_items_count, album.nodes.length)
                                        .replace('%1', this.timeline.selCount)
                                );

                                if (!prevCount) {
                                    this.timeline.adjustToBottomBar();
                                }
                            }
                            else {
                                window.selectionManager.hideSelectionBar();

                                if (prevCount) {
                                    this.timeline.adjustToBottomBar();
                                }
                            }

                            prevCount = this.timeline.selCount;
                        },
                        50
                    );
                },
                onDoubleClick: (cell) => {
                    const { h } = cell.el.ref.node;
                    this.timeline.clearSiblingSelections(h);

                    this.timeline.selections[h] = true;
                    cell.isSelected = true;
                    this._selCount++;

                    // double click will mess _selCount, so we need to reset here
                    if (scope.albums.grid && scope.albums.grid.timeline) {
                        const selHandles = scope.albums.grid.timeline.selections;
                        scope.albums.grid.timeline._selCount = Object.keys(selHandles).length;
                        scope.albums.grid.timeline.onSelectToggle();
                    }

                    delay('render:in_album_node_preview', () => {
                        const isVideo = scope.isVideo(cell.el.ref.node);

                        if (isVideo && !isVideo.isVideo) {
                            scope.reportDownload();
                            M.addDownload([h]);
                        }
                        else {
                            scope.playSlideshow(albumId, false, !!isVideo);
                        }
                    });
                },
                containerClass: 'album-timeline-main px-1 py-1',
                sidePadding: 4,
                interactiveCells: true
            });

            this.el.classList.add('album-content-grid');
            this.el.style.gridTemplateColumns = null;
            this.el.style.gridAutoRows = null;
            this.el.appendChild(this.timeline.el);

            delay('render:album_content_timeline', () => {
                if (this.timeline && this.timeline.el && albumId === scope.getAlbumIdFromPath()) {
                    window.selectionManager = new AlbumsSelectionManager(
                        albumId,
                        this.timeline.el
                    ).reinitialize();
                }
            });

            sortInAlbumNodes(album.nodes);
            this.timeline.nodes = album.nodes;
            this.timeline.setZoomControls();
        }

        addEmptyBlock(emptyPad) {
            if (!this.emptyBlock) {
                this.emptyBlock = emptyPad;
            }

            this.el.appendChild(this.emptyBlock.el);
        }

        removeEmptyBlock() {
            if (this.emptyBlock) {
                if (this.el.contains(this.emptyBlock.el)) {
                    this.el.removeChild(this.emptyBlock.el);
                }

                delete this.emptyBlock;
            }
        }

        /**
         * Making the grid react to the elements change
         * @param {Number} count Number of elements to render
         * @param {Boolean} [useDefaultEmptyPad] Indicates when the empty state is being handled from outside
         * @returns {void}
         */
        updateGridState(count, useDefaultEmptyPad = true) {
            let isEmpty = false;

            this.el.classList.remove('album-content-grid');

            if (count > bigAlbumCellsLimit) {
                this.el.classList.add('albums-grid-3-col');
                this.el.style.gridTemplateColumns = '200px 200px 200px';
                this.el.style.gridAutoRows = '200px';
            }
            else if (count > 0) {
                this.el.classList.remove('albums-grid-3-col');
                this.el.style.gridTemplateColumns = '300px 300px';
                this.el.style.gridAutoRows = '300px';
            }
            else {
                isEmpty = true;
                this.el.style.gridTemplateColumns = null;
                this.el.style.gridAutoRows = null;
            }

            if (useDefaultEmptyPad) {
                if (isEmpty) {
                    if (M.v.length) {
                        this.addEmptyBlock(new AlbumsEmpty(
                            l.no_albums,
                            l.create_new_album,
                            () => {
                                const dialog = new AlbumNameDialog();
                                dialog.show();
                            }
                        ));
                    }
                    else {
                        this.updateGridState(0, false);
                        this.addEmptyBlock(new NoMediaNoAlbums());
                    }
                }
                else {
                    this.removeEmptyBlock();
                }
                this.header.el.classList.toggle('invisible', isEmpty && !M.v.length);
            }

            delay('render:update_albums_grid', () => {
                applyPs(this.el, isEmpty);
            });
        }

        refresh() {
            this.updateGridState(
                Object.values(scope.albums.store).filter(album => albumIsRenderable(album)).length
            );
        }

        prepareAlbumCell(id) {
            const album = scope.albums.store[id];

            if (!album || !albumIsRenderable(album)) {
                return null;
            }

            let albumCell = album.cellEl;

            if (!albumCell) {
                albumCell = new AlbumCell(id);
                album.cellEl = albumCell;
                fillAlbumCell(albumCell.el);
            }

            albumCell.el.album.el = albumCell.el;

            return albumCell;
        }

        insertPredefinedAlbum(albumId) {
            const prevActiveSiblingAlbum = getPrevActivePredefinedAlbum(albumId, 'cellEl');
            const albumCell = this.prepareAlbumCell(albumId);

            if (prevActiveSiblingAlbum) {
                this.el.insertBefore(albumCell.el, prevActiveSiblingAlbum.cellEl.el.nextSibling);
            }
            else {
                this.el.prepend(albumCell.el);
            }

            if (albumCell.el.album.node && albumCell.el.album.node.fa !== albumCell.coverFa) {
                MegaGallery.addThumbnails([albumCell.el.album]);
            }
        }

        insertUserAlbum(id) {
            const albumCell = this.prepareAlbumCell(id);

            if (albumCell) {
                insertAlbumElement(id, albumCell.el, this.el, 'cellEl');

                if (albumCell.el.album.node && albumCell.el.album.node.fa !== albumCell.coverFa) {
                    MegaGallery.addThumbnails([albumCell.el.album]);
                }
                else {
                    scope.unsetShimmering(albumCell.el);
                }
            }
        }

        showAllAlbums() {
            const albumKeys = Object.keys(scope.albums.store);
            let albumsCount = 0;

            const thumbBlocks = [];

            for (let i = 0; i < albumKeys.length; i++) {
                const albumCell = this.prepareAlbumCell(albumKeys[i]);

                if (albumCell) {
                    if (albumCell.el.classList.contains('ui-selected')) {
                        albumCell.el.classList.remove('ui-selected');
                    }
                    this.el.appendChild(albumCell.el);
                    albumsCount++;

                    if (albumCell.el.album.node) {
                        thumbBlocks.push(albumCell.el.album);
                    }
                    else {
                        scope.unsetShimmering(albumCell.el);
                    }
                }
            }

            this.updateGridState(albumsCount);

            delay('render:albums_grid', () => {
                applyPs(this.el, !albumsCount);

                MegaGallery.addThumbnails(thumbBlocks);

                this.attachDragSelect();
                this.attachKeyboardEvents();

                this.lastSelected = null;
            });
        }

        attachDragSelect() {
            if (this.dragSelect) {
                this.dragSelect.dispose();
            }

            let initX = 0;
            let initY = 0;
            let albums = [];
            let area = [];

            const selectMatchingCells = () => {
                for (let i = 0; i < albums.length; i++) {
                    if (scope.isInSelectArea(albums[i].cellEl.el, area)) {
                        albums[i].cellEl.selectCell(false);
                    }
                    else {
                        albums[i].cellEl.deselectCell();
                    }
                }
            };

            this.dragSelect = new mega.ui.dragSelect(
                this.el,
                {
                    onDragStart: (xPos, yPos) => {
                        initX = xPos;
                        initY = this.el.scrollTop + yPos;
                        albums = Object.values(scope.albums.store).filter(a => albumIsRenderable(a) && a.cellEl);
                    },
                    onDragMove: (xPos, yPos) => {
                        area = [];

                        yPos += this.el.scrollTop;

                        if (xPos > initX) {
                            area.push(initX, xPos);
                        }
                        else {
                            area.push(xPos, initX);
                        }

                        if (yPos > initY) {
                            area.push(initY, yPos);
                        }
                        else {
                            area.push(yPos, initY);
                        }

                        selectMatchingCells();
                    },
                    onDragEnd: (wasDragging) => {
                        if (!wasDragging) {
                            AlbumCell.clearSiblingSelections();
                        }
                    },
                    onScrollUp: () => {
                        this.el.scrollTop -= 20;
                        selectMatchingCells();
                    },
                    onScrollDown: () => {
                        this.el.scrollTop += 20;
                        selectMatchingCells();
                    }
                }
            );
        }

        attachKeyboardEvents() {
            if (scope.disposeKeyboardEvents) {
                scope.disposeKeyboardEvents();
            }

            scope.disposeKeyboardEvents = (() => {
                const disposeKeydown = MComponent.listen(document, 'keydown', (evt) => {
                    if (evt.target !== document.body) {
                        return;
                    }

                    const albums = Object.values(scope.albums.store).filter(album => albumIsRenderable(album));

                    if (!albums.length) {
                        return true;
                    }

                    const { key, shiftKey } = evt;
                    const isCtrl = scope.getCtrlKeyStatus(evt);
                    const lastSelIndex = (this.lastSelected)
                        ? albums.findIndex(({ cellEl }) => cellEl.el === this.lastSelected)
                        : -1;
                    const albumsPerRow = (albums.length > bigAlbumCellsLimit) ? 3 : 2;
                    let curIndex = lastSelIndex;

                    const setFirstSelection = () => {
                        this.lastSelected = albums[0].cellEl.el;
                        albums[0].cellEl.selectCell();

                        return true;
                    };

                    const events = {
                        ArrowLeft: () => {
                            if (!this.lastSelected) {
                                setFirstSelection();
                            }

                            curIndex--;
                        },
                        ArrowUp: () => {
                            if (!this.lastSelected) {
                                setFirstSelection();
                            }

                            curIndex -= albumsPerRow;
                        },
                        ArrowRight: () => {
                            if (!this.lastSelected) {
                                setFirstSelection();
                            }

                            curIndex++;
                        },
                        ArrowDown: () => {
                            if (!this.lastSelected) {
                                setFirstSelection();
                            }

                            curIndex += albumsPerRow;
                        },
                        a: () => {
                            if (!isCtrl) {
                                return;
                            }

                            for (let i = 0; i < albums.length; i++) {
                                albums[i].cellEl.selectCell();
                            }

                            evt.preventDefault();
                            evt.stopPropagation();

                            return true;
                        },
                        Shift: () => {
                            this.shiftSelected = this.lastSelected;
                            return true;
                        }
                    };

                    if (!events[key] || events[key]() === true) {
                        return true;
                    }

                    evt.preventDefault();
                    evt.stopPropagation();

                    if (curIndex < 0) {
                        curIndex = (isCtrl || shiftKey) ? 0 : albums.length - 1;
                    }
                    else if (curIndex >= albums.length) {
                        curIndex = (isCtrl
                            || shiftKey
                            || (curIndex - lastSelIndex > 1 && curIndex - (albums.length - 1) < albumsPerRow))
                            ? albums.length - 1
                            : 0;
                    }

                    const albumCell = albums[curIndex].cellEl;
                    albumCell.selectCell();
                    this.lastSelected = albumCell.el;

                    const adjustScrollTop = () => {
                        if (albumCell.el.offsetTop < scope.albums.grid.el.scrollTop) {
                            scope.albums.grid.el.scrollTop = albumCell.el.offsetTop - scope.cellMargin * 3;
                        }
                        else {
                            const bottomOverlap = albumCell.el.offsetTop + albumCell.el.offsetHeight
                                - (scope.albums.grid.el.scrollTop + scope.albums.grid.el.clientHeight);

                            if (bottomOverlap > 0) {
                                scope.albums.grid.el.scrollTop += bottomOverlap + scope.cellMargin * 3;
                            }
                        }
                    };

                    const adjustSiblings = () => {
                        if (!isCtrl && !shiftKey) {
                            AlbumCell.clearSiblingSelections(albumCell.el);
                        }
                        else if (shiftKey) {
                            const shiftSelIndex = albums.findIndex(({ cellEl }) => cellEl.el === this.shiftSelected);

                            const arr = [curIndex, shiftSelIndex];
                            arr.sort((a, b) => a - b);

                            const [min, max] = arr;

                            for (let i = 0; i < albums.length; i++) {
                                if (i >= min && i <= max) {
                                    albums[i].cellEl.selectCell();
                                }
                                else {
                                    albums[i].cellEl.deselectCell();
                                }
                            }
                        }
                    };

                    adjustScrollTop();
                    adjustSiblings();
                });

                const disposeKeyup = MComponent.listen(document, 'keyup', ({ key }) => {
                    if (key === 'Shift') {
                        this.shiftSelected = null;
                    }
                });

                return () => {
                    disposeKeydown();
                    disposeKeyup();
                };
            })();
        }

        showAlbum(id) {
            this.initLayout();

            // Close info panel when visiting album
            mega.ui.mInfoPanel.closeIfOpen();

            if (M.isAlbumsPage(1)) {
                this.showAllAlbums();
                this.header.update();
                return;
            }

            const album = id ? scope.albums.store[id] : null;

            if (!album || !albumIsRenderable(album)) {
                openMainPage();
            }
            else {
                this.showAlbumContents(id);
                this.header.update(id);
                scope.reporter.report(false, 'Album');
            }
        }

        clear(removeGridContainer) {
            const { el, timeline } = this;

            while (el.firstChild) {
                el.removeChild(el.firstChild);
            }

            if (removeGridContainer && el.parentNode) {
                el.parentNode.removeChild(el);
            }

            if (timeline) {
                timeline.clear();
                delete this.timeline;
            }
        }

        removeHeader() {
            if (this.header) {
                this.header.el.parentNode.removeChild(this.header.el);
                this.header = null;
            }
        }

        updateInAlbumGrid(s) {
            if (M.currentdirid === 'albums/' + s) {
                const { timeline, header } = this;

                const album = mega.gallery.albums.store[s];

                if (!album) {
                    return;
                }

                // Checking if that is the first node and clearing up the empty state
                if (album.nodes.length === 1) {
                    this.removeEmptyBlock();
                    this.showAlbumContents(s);
                    header.update(s);
                }
                else {
                    delay('album:' + s + ':add_items', () => {
                        if (timeline) {
                            timeline.nodes = album.nodes;
                            header.update(s);

                            if (timeline.selCount > 0) {
                                window.selectionManager.showSelectionBar(
                                    mega.icu.format(l.album_selected_items_count, album.nodes.length)
                                        .replace('%1', timeline.selCount)
                                );
                            }
                        }
                    });
                }
            }
        }

        removeAlbum(album) {
            this.el.removeChild(album.cellEl.el);
        }
    }

    /**
     * Creates a tree for the sidebar with expandable first item and other ones treated as subitems
     * @class
     */
    class AlbumsTree {
        constructor(parent) {
            /**
             * @type {MSidebarButton?}
             */
            this.headButton = null;

            /**
             * @type {Object.<String, Object.<String, Object>>}
             */
            this.buttons = {
                predefined: {},
                userDefined: {}
            };

            this.el = document.createElement('div');
            this.el.className = 'lp-content-wrap';

            this.treeList = document.createElement('div');
            this.treeList.className = 'albums-tree-list collapse';

            this.el.appendChild(this.treeList);

            parent.appendChild(this.el);
            this.setHeader();
        }

        setPendingButton(label) {
            this.pendingBtn = new MSidebarButton(
                label + ' ' + l.album_name_creating,
                'icon-album',
                nop,
                'pending-btn subalbum-btn'
            );

            const firstUserAlbum = getFirstUserAlbum();

            if (firstUserAlbum) {
                this.treeList.insertBefore(this.pendingBtn.el, firstUserAlbum.button.el);
            }
            else {
                this.treeList.appendChild(this.pendingBtn.el);
            }
        }

        clearPendingButton() {
            if (this.pendingBtn) {
                this.treeList.removeChild(this.pendingBtn.el);
                delete this.pendingBtn;
            }
        }

        setHeader() {
            this.headButton = new MSidebarButton(
                l.albums,
                'icon-album',
                () => {
                    storeLastActiveTab();
                    mega.ui.mInfoPanel.closeIfOpen();

                    if (!M.isAlbumsPage(1)) {
                        openMainPage();
                    }

                    if (this.listExpanded) {
                        this.collapseList();
                    }
                    else {
                        this.expandList();
                    }
                }
            );

            this.headButton.isExpandable = checkIfExpandable();
            this.el.prepend(this.headButton.el);
        }

        clear(removeAll) {
            if (this.treeList) {
                while (this.treeList.firstChild) {
                    this.treeList.removeChild(this.treeList.firstChild);
                }
            }

            if (removeAll) {
                if (this.headButton) {
                    this.el.removeChild(this.headButton.el);
                    delete this.headButton;
                }

                if (this.treeList) {
                    this.el.removeChild(this.treeList);
                    delete this.treeList;
                }
            }
        }

        renderAlbumButtons() {
            const keys = Object.keys(scope.albums.store);

            for (let i = 0; i < keys.length; i++) {
                if (albumIsRenderable(scope.albums.store[keys[i]])) {
                    this.appendButton(keys[i]);
                }
            }
        }

        focusAlbum(id) {
            const album = id ? scope.albums.store[id] : null;

            if (!album || !albumIsRenderable(album)) {
                this.headButton.setActive();
            }
            else {
                scope.albums.store[id].button.setActive();
            }

            this.expandList();
        }

        unfocusAlbums() {
            this.headButton.unsetActive();
        }

        /**
         * Appending the list with the new button
         * @param {String} albumId The key of the album in the store
         * @returns {void}
         */
        appendButton(albumId) {
            const album = scope.albums.store[albumId];

            if (album) {
                if (!album.button) {
                    album.button = AlbumsTree.createButton(albumId, album.label, !!album.p);
                }

                if (!album.filterFn || album.nodes) {
                    this.treeList.appendChild(album.button.el);
                    this.headButton.isExpandable = true;
                }
            }
        }

        /**
         * Inserting the button into the existing list as per the order
         * @param {String} albumId Album id
         * @returns {void}
         */
        insertPredefinedButton(albumId) {
            const album = scope.albums.store[albumId];

            if (album) {
                if (!album.button) {
                    album.button = AlbumsTree.createButton(albumId, album.label, !!album.p);
                }

                const prevActiveSiblingAlbum = getPrevActivePredefinedAlbum(albumId, 'button');

                if (prevActiveSiblingAlbum) {
                    this.treeList.insertBefore(album.button.el, prevActiveSiblingAlbum.button.el.nextSibling);
                }
                else {
                    this.treeList.prepend(album.button.el);
                }

                this.headButton.isExpandable = true;
            }
        }

        removeAlbum(album) {
            if (album.button) {
                album.button.el.classList.remove('active');
                this.treeList.removeChild(album.button.el);
            }
        }

        expandList() {
            if (this.headButton) {
                this.listExpanded = true;
                this.headButton.el.classList.add('expansion-btn-open');
                this.treeList.classList.remove('collapse');
                this.adjustScrollBar();
            }
        }

        collapseList() {
            if (this.headButton) {
                this.listExpanded = false;
                this.headButton.el.classList.remove('expansion-btn-open');
                this.treeList.classList.add('collapse');
                this.adjustScrollBar();
            }
        }

        adjustScrollBar() {
            delay('render:albums_sidebar', () => {
                const sidebar = document.querySelector('.js-lp-gallery.lp-gallery .js-gallery-panel');
                applyPs(sidebar);
            });
        }
    }

    /**
     * @param {String} albumId Album ID
     * @param {String} label Button label
     * @param {Boolean} isShared Whether the album is already shared or not
     * @returns {MSidebarButton}
     */
    AlbumsTree.createButton = (albumId, label, isShared) => {
        const btn = new MSidebarButton(
            label,
            'icon-album',
            () => {
                storeLastActiveTab();
                mega.ui.mInfoPanel.closeIfOpen();

                const nextFolder = 'albums/' + albumId;

                if (!scope.albums.isPublic && M.currentdirid !== nextFolder) {
                    M.openFolder(nextFolder);
                }
            },
            'subalbum-btn'
        );

        btn.truncateOverflowText = true;
        btn.isShared = isShared;
        btn.attachEvent(
            'contextmenu',
            (evt) => {
                evt.preventDefault();
                if (!pfcol || scope.albums.store[albumId].nodes.length) {
                    const contextMenu = new AlbumContextMenu(albumId, scope.albums.isPublic);
                    contextMenu.show(evt.pageX, evt.pageY);
                }
            }
        );

        return btn;
    };

    /**
     * Creates a controlling class for AlbumsTree, AlbumsGrid and AlbumScroll
     */
    class Albums {
        constructor() {
            this.awaitingDbAction = false;
            this.grid = null;
            this.store = { // The length of the key should be always as per predefinedKeyLength
                fav: { id: 'fav', label: l.gallery_favourites, filterFn: () => false },
                mya: { id: 'mya', label: l.my_albums, filterFn: () => false },
                sha: { id: 'sha', label: l.shared_albums, filterFn: () => false },
                gif: {
                    id: 'gif',
                    label: l.album_key_gif,
                    filterFn: n => n.fa && fileext(n.name || '', true, true) === 'GIF'
                },
                raw: {
                    id: 'raw',
                    label: l.album_key_raw,
                    filterFn: n => n.fa
                        && is_rawimage(n.name) !== undefined
                        && !ignoreRaws[fileext(n.name || '', true, true)]
                }
            };

            this.tree = null;

            /**
             * This array holds all the subscribers for mega.sets
             * The stored functions represent `unsubscribe` methods for each of the subscriber
             * @type {Function[]}
             */
            this.setsSubscribers = [];
        }

        subscribeToSetsChanges() {
            if (Array.isArray(this.setsSubscribers) && this.setsSubscribers.length) {
                return;
            }

            this.setsSubscribers = [
                mega.sets.subscribe('asp', 'albums', (data) => {
                    const { id, at, k } = data;
                    const isPending = pendingName !== '' && mega.sets.decryptSetAttr(at, k).n === pendingName;

                    let prevName = '';
                    const album = this.store[id];
                    const isExisting = !!album;

                    if (isPending) {
                        this.grid.clearPendingCell();
                        this.tree.clearPendingButton();
                        pendingName = '';
                    }
                    else if (album) {
                        prevName = album.label;
                    }

                    sortStore();

                    if (isExisting) {
                        const ids = Object.keys(album.eIds);
                        data.e = Object.create(null);

                        for (let i = 0; i < ids.length; i++) {
                            const id = ids[i];

                            data.e[id] = {
                                id,
                                h: album.eIds[id]
                            };
                        }

                        data.p = album.p;
                    }

                    this.createAlbumData(data, unwantedHandles());

                    const nameChanged = album && prevName !== album.label;

                    sortStore();

                    if (isExisting) {
                        this.tree.removeAlbum(album);
                    }

                    this.addUserAlbumToTree(id, true);

                    if (M.isAlbumsPage(1)) {
                        if (isExisting) {
                            this.grid.removeAlbum(album);

                            if (album.cellEl && nameChanged) {
                                album.cellEl.updateName();
                            }
                        }

                        this.grid.insertUserAlbum(id);

                        if (!isExisting) {
                            this.grid.refresh();
                        }

                        delay('album:trigger_items_dialog', () => {
                            if (isPending && M.v.length) {
                                const dialog = new AlbumItemsDialog(id, true);
                                dialog.show();
                            }
                        }, 100);
                    }
                    else if (M.currentdirid === 'albums/' + id && this.grid) {
                        this.grid.header.setBreadcrumbsTitle(id);
                    }
                }),
                mega.sets.subscribe('asr', 'albums', ({ id }) => {
                    this.removeAlbumFromGridAndTree(id);

                    if (M.currentdirid === 'albums/' + id) {
                        if (this.grid.emptyBlock) {
                            this.grid.removeEmptyBlock();
                        }

                        openMainPage();
                    }
                }),
                mega.sets.subscribe('aep', 'albums', async({ s, h: handle, id }) => {
                    const album = scope.albums.store[s];

                    // Checking if the album is still available or if it has already got a requested node
                    if (!album || album.nodes.some(({ h }) => h === handle)) {
                        return;
                    }

                    if (!M.d[handle]) {
                        await dbfetch.get(handle);
                    }

                    album.nodes.push(M.d[handle]);
                    album.eHandles[handle] = id;
                    album.eIds[id] = handle;

                    debouncedAlbumCellUpdate(s, true);

                    if (this.grid) {
                        this.grid.updateInAlbumGrid(s);
                    }

                    debouncedLoadingUnset();
                }),
                mega.sets.subscribe('aer', 'albums', (element) => {
                    this.removeUserAlbumItem(element);
                }),
                mega.sets.subscribe('ass', 'albums', (share) => {
                    this.updateAlbumShare(share);
                })
            ];
        }

        getAvailableNodes(handles) {
            const nodes = [];

            if (Array.isArray(handles)) {
                for (let i = 0; i < handles.length; i++) {
                    const n = M.d[handles[i]];
                    console.assert(n, `node ${handles[i]} not in memory...`);
                    if (n) {
                        nodes.push(n);
                    }
                }
            }
            else {
                const fmNodes = Object.values(M.d);
                const ignoreHandles = unwantedHandles();

                for (let i = 0; i < fmNodes.length; i++) {
                    if (!scope.isGalleryNode(fmNodes[i])) {
                        continue;
                    }

                    const { fa, s, p, fv } = fmNodes[i];

                    if (fa && s && !ignoreHandles[p] && !fv) {
                        nodes.push(fmNodes[i]);
                    }
                }
            }

            return nodes;
        }

        async initPublicAlbum() {
            const albumData = {
                ...M.d[M.RootID],
                p: { ph: pfid }
            };
            const handles = M.c[M.RootID] ? Object.keys(M.c[M.RootID]) : [];

            this.isPublic = true;

            this.removeTree();
            this.initTree(document.querySelector('.js-fm-left-panel .fm-other-tree-panel.js-other-tree-panel'));

            this.createAlbumData(albumData, {}, true);

            for (const id in this.store) {
                if (Object.hasOwnProperty.call(this.store, id) && !this.store[id].filterFn && id !== albumData.id) {
                    delete this.store[id];
                }
            }

            scope.albumsRendered = false;
            MegaGallery.dbActionPassed = true;

            const availableNodes = this.getAvailableNodes(handles);

            if (availableNodes.length) {
                sortInAlbumNodes(availableNodes);
            }

            await this.buildAlbumsList(availableNodes);

            scope.fillMainView(availableNodes);
            const {id, button} = this.store[albumData.id];

            insertAlbumElement(id, button.el, this.tree.treeList, 'button');
            this.tree.focusAlbum(id);

            this.showAlbum(albumData.id);

            this.awaitingDbAction = false;
            this.subscribeToSetsChanges();

            const treePanel = $('section.fm-tree-panel', '.fm-main.default');

            $('.files-grid-view.fm, .fm-blocks-view.fm, .fm-right-header, .fm-empty-section').addClass('hidden');
            $('.tree', treePanel).addClass('hidden');
            $('.cloud-drive .lp-header span', treePanel).text(l.album_link);
            $('button.btn-galleries', treePanel).addClass('pl-4');

            if (handles.length) {
                $('.fm-import-to-cloudrive span', '.folder-link-btns-container').text(
                    (u_type)
                        ? l.context_menu_import
                        : l.btn_imptomega
                );
            }
            else {
                $('.folder-link-btns-container').addClass('hidden');
            }

            const rfBlock = $('.fm-right-files-block', '.fmholder');
            rfBlock.removeClass('hidden');
            $('.onboarding-control-panel', rfBlock).addClass('hidden');

            eventlog(99952);
        }

        /**
         * @param {String[]} handles Node handles to work with
         * @returns {void}
         */
        init(handles) {
            this.isPublic = false;
            const gallerySidebar = document.querySelector('.js-lp-gallery.lp-gallery .js-gallery-panel');
            const gallerySidebarWrap =
                document.querySelector('.js-lp-gallery.lp-gallery .js-gallery-panel .lp-content-wrap-wrap');
            const isAlbums = M.isAlbumsPage();
            const isGallery = M.isGalleryPage();

            if ((!isAlbums && !isGallery) || !gallerySidebar) {
                // It is either not a Gallery page or dom is broken
                return;
            }

            this.initTree(gallerySidebarWrap);
            delay('render:albums_sidebar', () => {
                applyPs(gallerySidebar);
            });

            if (!MegaGallery.dbActionPassed) {
                if (this.awaitingDbAction) {
                    return; // Some other part has already requested this
                }

                this.awaitingDbAction = true;

                if (isGallery) {
                    return;// Handles will be retrieved by Gallery
                }

                Albums.fetchDBDataFromGallery();
                return; // Fetch will re-trigger Albums.init() the second time after the db data is retrieved.
            }

            const availableNodes = this.getAvailableNodes(handles);

            if (availableNodes.length) {
                sortInAlbumNodes(availableNodes);
            }

            this.buildAlbumsList(availableNodes).then(() => {
                if (isAlbums) {
                    scope.fillMainView(availableNodes);
                    const id = M.currentdirid.replace(/albums\/?/i, '');

                    this.tree.focusAlbum(id);
                    this.showAlbum(id);
                }
                else {
                    loadingDialog.hide('MegaGallery');
                }

                this.awaitingDbAction = false;
            });

            this.subscribeToSetsChanges();
        }

        initTree(sidebar) {
            if (!this.tree) {
                if (M.isAlbumsPage()) {
                    loadingDialog.show('MegaGallery');
                }

                this.tree = new AlbumsTree(sidebar);
            }
        }

        initGrid() {
            if (!this.grid) {
                this.grid = new AlbumsGrid();
            }
        }

        /**
         * Generating buttons for predefined albums
         * @param {MegaNode[]} nodesArr array of nodes to process
         * @returns {void}
         */
        setPredefinedAlbums(nodesArr) {
            const nodesObj = Object.create(null);
            const covers = Object.create(null);
            const predefinedKeys = Object.keys(this.store).filter(k => k.length === predefinedKeyLength);
            const albums = [];

            for (let i = 0; i < nodesArr.length; i++) {
                const node = nodesArr[i];

                for (let j = 0; j < predefinedKeys.length; j++) {
                    const key = predefinedKeys[j];
                    const { filterFn } = this.store[key];

                    if (filterFn(node)) {
                        if (!covers[key]) {
                            covers[key] = node;
                        }

                        if (nodesObj[key]) {
                            nodesObj[key].push(node);
                        }
                        else {
                            nodesObj[key] = [node];
                        }

                        break;
                    }
                }
            }

            for (let i = 0; i < predefinedKeys.length; i++) {
                const key = predefinedKeys[i];
                const album = this.store[key];

                album.cellEl = null;

                if (nodesObj[key]) {
                    album.node = covers[key];
                    album.nodes = nodesObj[key];

                    this.tree.appendButton(key);
                    albums.push(album);
                }
                else {
                    this.store[key].nodes = [];
                }
            }

            return albums;
        }

        /**
         * Generating buttons for User-created albums
         * @returns {Object[]}
         */
        async setUserAlbums() {
            const albums = [];

            if (!this.isPublic) {
                const sets = Object.values(await mega.sets.buildTmp());

                if (!Array.isArray(sets) || !sets.length) {
                    return [];
                }

                const ignoreHandles = unwantedHandles();

                for (let i = 0; i < sets.length; i++) {
                    albums.push(this.createAlbumData(sets[i], ignoreHandles));
                }
            }

            sortStore();

            const userAlbums = Object.values(this.store);

            for (let i = 0; i < userAlbums.length; i++) {
                if (!userAlbums[i].filterFn) {
                    this.addUserAlbumToTree(userAlbums[i].id);
                }
            }

            return albums;
        }

        /**
         * @param {MegaNode} nodesArr Array of nodes to filter through
         * @returns {void}
         */
        async buildAlbumsList(nodesArr) {
            if (scope.albumsRendered) {
                this.tree.renderAlbumButtons();
            }
            else {
                if (this.tree && this.tree.treeList.children.length > 0) {
                    this.tree.clear();
                }

                if (!this.isPublic) {
                    const albums = Object.values(this.store);

                    for (let index = 0; index < albums.length; index++) {
                        const { id, filterFn } = albums[index];

                        if (!filterFn) {
                            delete this.store[id];
                        }
                    }

                    this.setPredefinedAlbums(nodesArr);
                }

                await this.setUserAlbums();

                scope.albumsRendered = true;

                if (this.tree && this.tree.headButton) {
                    this.tree.headButton.isExpandable = checkIfExpandable();
                }
            }

            if (this.isPublic) {
                this.tree.headButton.el.classList.add('hidden');
            }
            else {
                this.tree.headButton.el.classList.remove('hidden');
            }
        }

        /**
         * @param {Object.<String, any>} data Set data to process
         * @param {Object.<String, Boolean>} ignoreHandles Handles to ignore when add to the album
         * @param {Boolean} [isPublic] Whether the specified key is encrypted
         * @returns {void}
         */
        createAlbumData({ e, at, k, id, ts, p, cts }, ignoreHandles, isPublic) {
            const attr = at === '' || !at ? {} : isPublic
                ? mega.sets.decryptPublicSetAttr(at, k)
                : mega.sets.decryptSetAttr(at, k);
            const label = attr.n || l.unknown_album_name;
            const coverHandle = attr.c || '';
            let album = this.store[id];
            const nodes = [];
            const eHandles = Object.create(null);
            const eIds = Object.create(null);
            let node = null;

            if (e) {
                const elements = Object.values(e);

                for (let i = 0; i < elements.length; i++) {
                    const { h, id } = elements[i];

                    if (M.d[h] && !ignoreHandles[M.d[h].p] && !eHandles[h]) {
                        nodes.push(M.d[h]);

                        if (id === coverHandle) {
                            node = M.d[h];
                        }
                    }

                    eHandles[h] = id;
                    eIds[id] = h;
                }
            }

            sortInAlbumNodes(nodes);

            if (!node) {
                node = nodes[0];
            }

            if (album) {
                album.at = attr;
                album.k = k;
                album.label = label;
                album.ts = ts;
                album.button.label = label;
                album.nodes = nodes;
                album.node = node;
                album.eHandles = eHandles;
                album.eIds = eIds;
                album.p = p;
            }
            else {
                album = {
                    at: attr,
                    k,
                    id,
                    label,
                    nodes,
                    node,
                    button: AlbumsTree.createButton(id, label, !!p),
                    ts,
                    cts,
                    eHandles,
                    eIds,
                    p
                };

                this.store[id] = album;
            }

            return album;
        }

        /**
         * Adding/removing share to an album
         * @param {Object.<String, String|Number>} payload The share payload
         * @returns {void}
         */
        updateAlbumShare({ ph, s, ts, r }) {
            const album = this.store[s];

            if (!album) {
                return;
            }

            const removing = r === 1;

            if (removing) {
                if (album.p) {
                    delete album.p;
                }
            }
            else {
                album.p = { ph, ts };
            }

            if (album.button) {
                album.button.isShared = !removing;
            }

            if (s === scope.getAlbumIdFromPath() && this.grid && this.grid.header) {
                this.grid.header.update(s);
            }

            if (album.cellEl) {
                album.cellEl.isShared = !removing;
            }
        }

        /**
         * @param {String} albumId Album ID
         * @param {Boolean} toInsert Whether to insert an album among the others or just append the list
         * @returns {void}
         */
        addUserAlbumToTree(albumId, toInsert) {
            const album = this.store[albumId];

            if (!album) {
                return;
            }

            if (toInsert) {
                insertAlbumElement(albumId, album.button.el, this.tree.treeList, 'button');
            }
            else {
                this.tree.treeList.appendChild(album.button.el);
            }

            if (this.tree.headButton) {
                this.tree.headButton.isExpandable = true;
            }
        }

        showAlbum(id) {
            this.initGrid();
            this.grid.showAlbum(id);
        }

        clearSubscribers() {
            if (this.setsSubscribers) {
                for (let i = 0; i < this.setsSubscribers.length; i++) {
                    this.setsSubscribers[i]();
                }
            }

            this.setsSubscribers = [];
        }

        removeKeyboardListener() {
            if (scope.disposeKeyboardEvents) {
                scope.disposeKeyboardEvents();
            }

            scope.disposeKeyboardEvents = null;
        }

        disposeInteractions() {
            if (this.grid && this.grid.timeline) {
                this.grid.timeline.clear();
            }
            else {
                this.removeKeyboardListener();
            }

            if (this.tree) {
                this.tree.unfocusAlbums();
            }

            this.removeGrid();
        }

        disposeAll() {
            this.disposeInteractions();

            this.removeTree();
            this.clearSubscribers();

            if (this.grid) {
                this.grid.clear();
            }
        }

        removeTree() {
            if (this.tree) {
                this.tree.clear(true);
                delete this.tree;
            }
        }

        removeGrid() {
            if (this.grid) {
                this.grid.clear(true);
                this.grid.removeHeader();

                const albumsView = document.getElementById('albums-view');

                if (albumsView && !albumsView.classList.contains('hidden')) {
                    albumsView.classList.add('hidden');
                }

                this.grid = null;
            }
        }

        /**
         * This method removes album from tree and grid by id
         * @param {String} albumId Album ID
         * @returns {void}
         */
        removeAlbumFromGridAndTree(albumId) {
            const album = this.store[albumId];

            if (!album) {
                return;
            }

            const onMainAlbumsGrid = this.grid && M.isAlbumsPage(1) && album.cellEl;

            if (this.tree) {
                this.tree.removeAlbum(album);
            }

            if (onMainAlbumsGrid) {
                this.grid.removeAlbum(album);
            }

            if (!album.filterFn) {
                delete this.store[albumId];
            }

            if (onMainAlbumsGrid) {
                this.grid.refresh();
            }

            delay('album:clean_grid_and_tree', () => {
                if (this.tree && this.tree.headButton) {
                    this.tree.headButton.isExpandable = checkIfExpandable();
                }
            });
        }

        /**
         * Reacting to the global removal of the node
         * @param {MegaNode} node Removed MegaNode
         * @returns {void}
         */
        onCDNodeRemove(node) {
            if (node.t) {
                if (M.c[node.h]) {
                    const childKeys = Object.keys(M.c[node.h]);

                    for (let i = 0; i < childKeys.length; i++) {
                        const n = M.d[childKeys[i]];

                        if (n) {
                            this.onCDNodeRemove(n);
                        }
                    }
                }

                return;
            }

            if (!scope.isGalleryNode(node)) {
                return;
            }

            const albumKeys = Object.keys(this.store)
                .filter(k => Array.isArray(this.store[k].nodes) && this.store[k].nodes.length > 0);

            if (!albumKeys.length) {
                return;
            }

            const { h: handle } = node;

            for (let i = 0; i < albumKeys.length; i++) {
                removeNodeFromAlbum(albumKeys[i], handle);
            }

            if (slideshowid) {
                tmpMv.splice(tmpMv.indexOf(node), 1);
            }

            if ($.timelineDialog) {
                removeNodeFromTimelineDialog(handle);
            }
        }

        /**
         * Reacting to the global change of the node
         * @param {MegaNode} node Updated MegaNode
         * @returns {void}
         */
        onCDNodeUpdate(node) {
            if (node.t) {
                if (M.c[node.h]) {
                    const childKeys = Object.keys(M.c[node.h]);

                    for (let i = 0; i < childKeys.length; i++) {
                        const n = M.d[childKeys[i]];

                        if (n) {
                            this.onCDNodeUpdate(n);
                        }
                    }
                }

                return;
            }

            if (M.getNodeRoot(node.p) === M.RubbishID) {
                this.onCDNodeRemove(node);
                return;
            }

            if (!scope.isGalleryNode(node)) {
                return;
            }

            const keys = Object.keys(this.store);

            for (let i = 0; i < keys.length; i++) {
                this.updateAlbumDataByUpdatedNode(keys[i], node);
            }

            if (M.currentCustomView.type === 'albums' && !M.v.includes(node)) {
                M.v.push(node);
                sortInAlbumNodes(M.v);
            }

            if ($.timelineDialog) {
                this.updateTimelineDialog();
            }
        }

        removeUserAlbumItem({ id, s }) {
            const album = this.store[s];

            if (!album || !album.eIds[id]) {
                return;
            }

            const delHandle = album.eIds[id];
            this.isCover = this.isCover || album.node && album.node.h === delHandle;

            album.nodes = album.nodes.filter(({ h }) => h !== delHandle);

            delete album.eHandles[delHandle];
            delete album.eIds[id];

            delay('album:' + s + ':update_placeholder', () => {
                if (album.nodes.length) {
                    if (this.isCover) {
                        album.node = album.nodes[0];
                    }
                }
                else {
                    delete album.node;
                }

                if (album.cellEl) {
                    album.cellEl.updatePlaceholders();

                    if (!album.node || this.isCover || album.node.fa !== album.cellEl.coverFa) {
                        album.cellEl.updateCoverImage();
                    }
                }

                delete this.isCover;
            });

            if (M.currentdirid === 'albums/' + s) {
                if (this.grid.timeline && this.grid.timeline.selections[delHandle]) {
                    this.grid.timeline.deselectNode(M.d[delHandle]);
                }

                if (album.nodes.length) {
                    delay('album:' + s + ':remove_items', () => {
                        if (this.grid.timeline) {
                            this.grid.timeline.nodes = album.nodes;
                        }

                        this.grid.header.update(s);
                    });
                }
                else {
                    this.grid.header.update(s);
                    this.grid.showEmptyAlbumPage(s);
                }
            }
        }

        /**
         * Updating grid and tree after adding a node to an album
         * @param {String} albumId Album id
         * @returns {void}
         */
        updateGridAfterAddingNode(albumId, node) {
            const album = this.store[albumId];

            if (!album) {
                return;
            }

            // Creating the predefined album buttons if it has received it's first node (was hidden before)
            if (album.filterFn && album.nodes.length === 1) {
                if (M.isAlbumsPage() || M.isGalleryPage()) {
                    this.tree.insertPredefinedButton(albumId);
                }

                if (M.isAlbumsPage(1) && this.grid) {
                    this.grid.insertPredefinedAlbum(albumId);
                    this.grid.refresh();
                    this.grid.header.update();
                }
            }

            const coverNode = album.eHandles && album.at && album.eHandles[node.h] === album.at.c ? node : undefined;
            debouncedAlbumCellUpdate(albumId, true, false, coverNode);

            if (albumId === scope.getAlbumIdFromPath() && this.grid) {
                if (album.nodes.length === 1) {
                    this.grid.removeEmptyBlock();
                    this.grid.showAlbumContents(albumId);
                    this.grid.header.update(albumId);
                }
                else {
                    delay('album:' + albumId + ':add_items', () => {
                        if (this.grid && this.grid.timeline) {
                            this.grid.timeline.nodes = album.nodes;
                            this.grid.header.update(albumId);

                            if (this.grid.timeline.selCount > 0) {
                                window.selectionManager.showSelectionBar(
                                    mega.icu.format(l.album_selected_items_count, album.nodes.length)
                                        .replace('%1', this.grid.timeline.selCount)
                                );
                            }
                        }
                    });
                }
            }
        }

        /**
         * Updating the data of the specific album based on the new node details
         * @param {String} albumId Album id
         * @param {MegaNode} node Updated node
         * @returns {void}
         */
        updateAlbumDataByUpdatedNode(albumId, node) {
            const { h: handle } = node;
            const album = this.store[albumId];
            const additionIsNeeded = album
                && ((album.filterFn && album.filterFn(node)) || (!album.filterFn && album.eHandles[handle]))
                ? !album.nodes || !album.nodes.length || !album.nodes.some(({ h }) => h === handle)
                : false;

            if (additionIsNeeded) {
                album.nodes = (Array.isArray(album.nodes)) ? [...album.nodes, node] : [node];

                if (this.grid) {
                    this.updateGridAfterAddingNode(albumId, node);
                    debouncedLoadingUnset();
                }
            }
        }

        /**
         * Updating the data of the timeline dialog based on the new node details
         * @param {MegaNode} node Updated node
         * @returns {void}
         */
        updateTimelineDialog() {
            const timeline = $.timelineDialog.timeline;

            if (timeline) {
                delay('timeline_dialog:add_items', () => {
                    timeline.nodes = M.v;
                });
            }
        }

        static fetchDBDataFromGallery() {
            const passDbAction = (handles) => {
                MegaGallery.dbActionPassed = true;

                if (scope.albums.awaitingDbAction) {
                    scope.albums.init(handles);
                }
            };

            /**
             * @param {Object[]} nodes Nodes fetched from local DB to parse
             * @param {Boolean} skipDbFetch Skipping individual node fetch, when it is being loaded already
             * @returns {void}
             */
            const parseNodes = (nodes, skipDbFetch) => {
                const ignoreHandles = unwantedHandles();
                const handles = [];

                if (Array.isArray(nodes)) {
                    for (let i = 0; i < nodes.length; i++) {
                        if (!scope.isGalleryNode(nodes[i])) {
                            continue;
                        }

                        const { fa, s, p, h, fv } = nodes[i];

                        if (fa && s && !ignoreHandles[p] && !fv) {
                            handles.push(h);
                        }
                    }
                }

                if (skipDbFetch) {
                    passDbAction(handles);
                }
                else {
                    dbfetch.geta(handles)
                        .then(() => {
                            passDbAction(handles);
                        })
                        .catch(nop);
                }
            };

            MegaGallery.dbAction()
                .then(parseNodes)
                .catch(() => {
                    console.warn('Local DB failed. Fetching nodes from memory...');
                    parseNodes(Object.values(M.d), true);
                });
        }

        requestAlbumElementsRemoval() {
            if (!this.grid || !this.grid.timeline || !this.grid.timeline.selCount) {
                return;
            }

            const dialog = new RemoveAlbumItemsDialog(Object.keys(this.grid.timeline.selections));
            dialog.show();
        }

        removeElementsByHandles(handles) {
            loadingDialog.show('MegaAlbumsRemoveItems');

            const album = scope.albums.store[scope.getAlbumIdFromPath()];
            const ids = [];
            const handlesCache = {};
            const statsObj = {
                delImg: 0,
                delVid: 0,
                leftImg: 0,
                leftVid: 0
            };

            for (let i = 0; i < handles.length; i++) {
                ids.push(album.eHandles[handles[i]]);
                handlesCache[handles[i]] = true;
            }

            // Building stats object for removed and left items
            for (let i = 0; i < album.nodes.length; i++) {
                statsObj[
                    (handlesCache[album.nodes[i].h] ? 'del' : 'left')
                    + (scope.isVideo(album.nodes[i]) ? 'Vid' : 'Img')
                ]++;
            }

            mega.sets.elements.bulkRemove(
                ids,
                album.id
            ).then(() => {
                const content = generateToastContent(
                    mega.icu
                        .format(l.album_items_removed_status, handles.length)
                        .replace('%s', limitNameLength(album.label))
                );

                toaster.main.show({
                    icons: ['sprite-fm-mono icon-bin text-color-medium'],
                    content
                });

                delay(
                    'albums_stat_99917',
                    eventlog.bind(null, 99917, JSON.stringify(statsObj))
                );
            }).catch(() => {
                console.error('Could not remove the album items...');
            }).finally(() => {
                loadingDialog.hide('MegaAlbumsRemoveItems');
            });
        }

        previewSelectedElements() {
            scope.playSlideshow(scope.getAlbumIdFromPath());
        }

        downloadSelectedElements() {
            if (this.grid && this.grid.timeline && this.grid.timeline.selCount) {
                scope.reportDownload();
                M.addDownload(Object.keys(this.grid.timeline.selections));
            }
        }

        updateAlbumCover({ at, id, k, eHandles }, handle) {
            loadingDialog.show('MegaAlbumsUpdateCover');

            mega.sets.updateAttrValue({ at, k, id }, 'c', eHandles[handle] || '')
                .then(() => {
                    if (this.grid && this.grid.timeline) {
                        this.grid.timeline.clearSiblingSelections();
                    }

                    toaster.main.show({
                        icons: ['sprite-fm-mono icon-images text-color-medium'],
                        content: l.album_cover_updated
                    });
                })
                .catch(dump)
                .finally(() => {
                    loadingDialog.hide('MegaAlbumsUpdateCover');
                });
        }

        async getUniqueSetName(setNode) {
            const sets = Object.values(await mega.sets.buildTmp());
            const names = Object.create(null);
            const  { h, name } = setNode;

            for (let i = 0; i < sets.length; i++) {
                const { at, k } = sets[i];

                tryCatch(() => {
                    names[mega.sets.decryptSetAttr(at, k).n] = true;
                })();
            }

            if (!names[name]) {
                return name;
            }

            const newName = await AlbumNameDialog.prompt($.albumImport.id, names);

            return (newName === null) ? null : newName || name;
        }

        /**
         * @param {String[]} albumIds Album ids to add the share for
         * @returns {void}
         */
        addShare(albumIds) {
            mega.Share.initCopyrightsDialog(
                [],
                false,
                async() => {
                    delete $.itemExport;
                    delete $.itemExportEmbed;
                    loadingDialog.show('MegaAlbumsAddShare');

                    const promises = [];
                    const availableIds = [];

                    const { getSetById, elements } = mega.sets;

                    for (let i = 0; i < albumIds.length; i++) {
                        const id = albumIds[i];
                        const album = scope.albums.store[id];

                        if (!album) {
                            continue;
                        }

                        // Checking that all elements are good to be a part of share
                        const s = await getSetById(id).catch((ex) => console.error(ex));

                        availableIds.push(id);

                        if (!album.p) {
                            promises.push(mega.sets.addShare(id));
                        }

                        if (!s) {
                            continue;
                        }

                        const elsToReset = {};
                        const { e, k } = s;

                        if (e && typeof e === 'object') {
                            const minKeyLen = 43; // The length of 32b ByteArray in Base64 string

                            for (const eId in e) {
                                if (Object.hasOwnProperty.call(e, eId)) {
                                    const { h, k, o, at, ts } = e[eId];

                                    // Repairing the elements with old incorrect keys
                                    if (k.length < minKeyLen || (!at && ts < 1695340800)) {
                                        elsToReset[eId] = { h, o: o || 1500 };
                                    }
                                }
                            }
                        }

                        const eIds = Object.keys(elsToReset);

                        if (eIds.length) {
                            elements.bulkRemove(eIds, id)
                                .then(() => {
                                    return elements.bulkAdd(Object.values(elsToReset), id, k);
                                })
                                .catch(dump);
                        }
                    }

                    Promise.all(promises)
                        .then((results) => {
                            for (let i = 0; i < results.length; i++) {
                                const p = results[i][1] || results[i];

                                // In case there is a race, it is safer to assign ass result to albums directly
                                if (!scope.albums.store[availableIds[i]].p) {
                                    scope.albums.store[availableIds[i]].p = p;
                                }
                            }

                            loadingDialog.hide('MegaAlbumsAddShare');
                            const dialog = new AlbumShareDialog(availableIds);
                            dialog.show();
                        })
                        .catch((ex) => {
                            loadingDialog.hide('MegaAlbumsAddShare');
                            dump(ex);
                        });
                }
            );
        }

        /**
         * @param {String} albumIds Album ids to remove the share from
         * @returns {void}
         */
        removeShare(albumIds) {
            loadingDialog.show('MegaAlbumsRemoveShare');

            const idsToClear = [];

            for (let i = 0; i < albumIds.length; i++) {
                const id = albumIds[i];
                const album = scope.albums.store[id];

                if (album && album.p) {
                    idsToClear.push(id);
                }
            }

            if (!idsToClear.length) {
                loadingDialog.hide('MegaAlbumsRemoveShare');
                return;
            }

            Promise.all(idsToClear.map(id => mega.sets.removeShare(id)))
                .catch(dump)
                .finally(() => {
                    loadingDialog.hide('MegaAlbumsRemoveShare');
                });
        }
    }

    return new Albums();
});

lazy(mega.gallery, 'AlbumTimeline', () => {
    'use strict';

    const scope = mega.gallery;
    const { albums } = scope;
    const defZoomStep = 2;

    /**
     * Getting the month label for the node
     * @param {MegaNode} node Node to fetch the label from
     * @returns {String}
     */
    const getMonthLabel = ({ mtime, ts }) => GalleryNodeBlock.getTimeString(mtime || ts, 3);

    let globalZoomStep = defZoomStep;

    const fillAlbumTimelineCell = (el) => {
        if (el.ref.isVideo) {
            el.dataset.videoDuration = secondsToTimeShort(MediaAttribute(el.ref.node).data.playtime);
            el.classList.add('show-video-duration');
        }
    };

    class AlbumItemContextMenu extends MMenuSelect {
        constructor() {
            super();

            const selections = Object.keys(albums.grid.timeline.selections);
            const albumId = scope.getAlbumIdFromPath();
            const album = albums.store[albumId];
            const { filterFn, at, eIds, nodes } = album;
            const options = [];
            let selectionsPreviewable = false;

            const isCoverChangeable = !filterFn
                && selections.length === 1
                && (!at.c || eIds[at.c] !== selections[0]);
            const onlyPlayableVideosSelected = selections.every((h) => !!is_video(M.d[h]));

            for (let i = 0; i < selections.length; i++) {
                if (scope.isPreviewable(M.d[selections[i]])) {
                    selectionsPreviewable = true;
                    break;
                }
            }

            if (onlyPlayableVideosSelected) {
                options.push({
                    label: l.album_play_video,
                    icon: 'video-call-filled',
                    click: () => {
                        scope.playSlideshow(albumId, false, true);
                    }
                });
            }
            else if (scope.nodesAllowSlideshow(nodes)) {
                options.push({
                    label: l.album_play_slideshow,
                    icon: 'play-square',
                    click: () => {
                        scope.playSlideshow(albumId, true);
                    }
                });
            }

            if (selectionsPreviewable) {
                options.push(
                    {
                        label: l.album_item_preview_label,
                        icon: 'preview-reveal',
                        click: () => {
                            scope.playSlideshow(albumId);
                        }
                    }
                );
            }

            if (options.length) {
                options.push({});
            }

            options.push(
                {
                    label: l.album_download,
                    icon: 'download-small',
                    click: () => {
                        if (M.currentdirid !== `albums/${albumId}`) {
                            return;
                        }

                        const handles = scope.getAlbumsHandles([albumId]);

                        if (!handles.length) {
                            return;
                        }

                        scope.reportDownload();
                        M.addDownload(handles);
                    }
                }
            );

            if (isCoverChangeable) {
                options.push({
                    label: l.set_as_album_cover,
                    icon: 'images',
                    click: () => {
                        if (albums.grid.timeline.selCount === 1) {
                            albums.updateAlbumCover(album, Object.keys(albums.grid.timeline.selections)[0]);
                        }
                    }
                });
            }

            if (!filterFn) {
                options.push(
                    {},
                    {
                        label: l.album_item_remove_label,
                        icon: 'bin',
                        click: () => {
                            albums.requestAlbumElementsRemoval();
                        },
                        classes: ['red']
                    }
                );
            }

            this.options = options;
        }
    }

    class PublicAlbumItemContextMenu extends MMenuSelect {
        constructor() {
            super();

            const selections = Object.keys(albums.grid.timeline.selections);

            const albumId = scope.getAlbumIdFromPath();
            const { nodes } = albums.store[albumId];
            const options = [];

            const hasImageSelected = selections.some(h => !!scope.isImage(M.d[h]));
            const onlyPlayableVideosSelected = selections.every((h) => !!is_video(M.d[h]));

            if (hasImageSelected) {
                options.push({
                    label: l.album_item_preview_label,
                    icon: 'preview-reveal',
                    click: () => {
                        scope.playSlideshow(albumId);
                    }
                });

                if (scope.nodesAllowSlideshow(nodes)) {
                    options.push({
                        label: l.album_play_slideshow,
                        icon: 'play-square',
                        click: () => {
                            scope.playSlideshow(albumId, true);
                        }
                    });
                }
            }

            if (onlyPlayableVideosSelected) {
                options.push({
                    label: l.album_play_video,
                    icon: 'video-call-filled',
                    click: () => {
                        scope.playSlideshow(albumId, false, true);
                    }
                });
            }

            options.push(
                {},
                {
                    label: l.album_download,
                    icon: 'download-small',
                    click: () => {
                        if (!M.isAlbumsPage()) {
                            return;
                        }

                        eventlog(99954);
                        M.addDownload(selections);
                    }
                },
                {},
                {
                    label: l[6859],
                    icon: 'info',
                    click: () => {
                        $.selected = selections;
                        mega.ui.mInfoPanel.initInfoPanel();
                    }
                },
                {},
                {
                    label: (u_type) ? l.context_menu_import : l.btn_imptomega,
                    icon: (u_type) ? 'upload-to-cloud-drive' : 'mega-thin-outline',
                    click: () => {
                        if (M.isInvalidUserStatus()) {
                            return;
                        }

                        assert(albums.isPublic, 'This import needs to happen in public album only...');

                        eventlog(99832);
                        M.importFolderLinkNodes(selections);
                    }
                }
            );

            this.options = options;
        }
    }

    class AlbumTimelineCell extends MComponent {
        /**
         * @param {Object.<String, any>} data Data for the cell
         * @param {MegaNode} data.node Node to base on
         * @param {Function} data.clickFn Single click handler
         * @param {Function} data.dbclickFn Double click handler
         * @param {Boolean} data.useMenu Whether to use context menu or skip it
         */
        constructor({ node, clickFn, dbclickFn, useMenu }) {
            super();

            this.el.ref = {
                node,
                isVideo: !!scope.isVideo(node),
                setThumb: (dataUrl) => {
                    this.setThumb(dataUrl);
                }
            };

            this.el.setAttribute('title', node.name);
            this.el.setAttribute('id', node.h);

            this._active = true;
            this._selected = false;

            this.attachEvents(clickFn, dbclickFn, useMenu);
        }

        get isActive() {
            return this._active;
        }

        /**
         * Using this parameter to grey-out the cell when needed
         * @param {Boolean} status Active status
         * @returns {void}
         */
        set isActive(status) {
            if (status) {
                this.el.classList.remove('opacity-50');
            }
            else {
                this.el.classList.add('opacity-50');
            }
        }

        get isSelected() {
            return this._selected;
        }

        /**
         * @param {Boolean} status Selected status
         * @returns {void}
         */
        set isSelected(status) {
            if (status === this._selected) {
                return;
            }

            if (status) {
                this.el.classList.add('ui-selected');

                const check = document.createElement('i');
                check.className = 'sprite-fm-mono icon-check-circle icon-size-6';
                this.el.appendChild(check);
                this._selected = true;

                if (!this._active) {
                    this.isActive = true;
                }
            }
            else {
                this.el.classList.remove('ui-selected');
                this.el.removeChild(this.el.querySelector('i.icon-check-circle'));
                this._selected = false;
            }
        }

        buildElement() {
            this.el = document.createElement('div');
            this.el.className = 'album-timeline-cell cursor-pointer';
        }

        attachEvents(clickFn, dbclickFn, useMenu) {
            if (clickFn) {
                this.attachEvent('mouseup', (evt) => {
                    if (evt.which === 3) {
                        return false;
                    }

                    if (!evt.detail || evt.detail === 1) {
                        clickFn(this, evt);
                    }
                    else if (evt.detail === 2) {
                        dbclickFn(this, evt);
                    }
                });
            }

            if (useMenu) {
                this.attachEvent(
                    'contextmenu',
                    (evt) => {
                        evt.preventDefault();
                        const { pageX, pageY, target } = evt;

                        if (!this.isSelected) {
                            clickFn(this, evt);
                        }

                        if (albums.isPublic) {
                            const contextMenu = new PublicAlbumItemContextMenu(target);
                            contextMenu.show(pageX, pageY);
                        }
                        else {
                            const contextMenu = new AlbumItemContextMenu(target);
                            contextMenu.show(pageX, pageY);
                        }
                    }
                );
            }
        }

        applyMonthLabel(label) {
            this.el.classList.add('show-date');
            this.el.dataset.date = label;
        }

        removeMonthLabel() {
            this.el.classList.remove('show-date');
        }

        setThumb(dataUrl) {
            this.el.style.backgroundImage = `url('${dataUrl}')`;
            this.el.style.backgroundColor = 'white';
            this.naturalSize = this.el.style.width;
            if (this.el.classList.contains('shimmer')) {
                scope.unsetShimmering(this.el);
            }
        }
    }

    class AlbumTimeline extends MComponent {
        /**
         * The sorted list of nodes (newest at top) with the specific handler
         * @param {Object.<String, any>} options Options object
         * @param {Function} options.onSelectToggle Method is called when the cell status is changed
         * @param {Function} options.onDoubleClick Method is called when the cell is double clicked
         * @param {String} [options.containerClass] Additional classes for container
         * @param {Number} [options.sidePadding] Use this correction, if container classes include x-axis padding
         * @param {Boolean} [options.showMonthLabel] Whether to show month timestamps or not
         * @param {Boolean} [options.interactiveCells] Whether cells should react to context menu and selections
         * @param {Boolean} [options.selectionLimit] Whether a multiple selection is allowed or not
         * @param {Boolean} [options.skipGlobalZoom] Whether to use global zoom or the locally created one
         */
        constructor({
            onSelectToggle,
            onDoubleClick,
            containerClass,
            sidePadding,
            showMonthLabel,
            interactiveCells,
            selectionLimit,
            skipGlobalZoom
        }) {
            super(null, false);

            this.sidePadding = sidePadding || 0;

            if (typeof containerClass === 'string') {
                this.el.className = containerClass;
            }

            this.dynamicList = false;

            this.rowIndexCache = {};
            this.cellCache = {};
            this.initialRender = true;

            this.selections = {};
            this.selectArea = null;
            this.shiftSelectedIndexes = [];

            this.onSelectToggle = onSelectToggle;
            this.onDoubleClick = onDoubleClick;
            this.showMonthLabel = showMonthLabel;
            this.interactiveCells = interactiveCells;
            this.skipGlobalZoom = skipGlobalZoom;
            this.selectionLimit = selectionLimit || 0;

            this._zoomStep = skipGlobalZoom ? defZoomStep : globalZoomStep;
            this._limitReached = false;
            this._selCount = 0;

            this.el.classList.add(`album-timeline-zoom-${this._zoomStep}`);
            this.attachEvents();
        }

        get selCount() {
            return this._selCount;
        }

        get rowHeight() {
            return this.cellSize + scope.cellMargin * 2;
        }

        get zoomStep() {
            return this._zoomStep;
        }

        get limitReached() {
            return this._limitReached;
        }

        /**
         * @param {Boolean} status Whether the limit is reached or not
         */
        set limitReached(status) {
            this._limitReached = status;

            delay('album_timeline:toggle_cell_activation', () => {
                const selector = '.album-timeline-cell'
                    + (this._limitReached ? ':not(.opacity-50)' : '.opacity-50')
                    + ':not(.ui-selected)';


                const cellsToToggle = this.el.querySelectorAll(selector);

                if (cellsToToggle.length) {
                    for (let i = 0; i < cellsToToggle.length; i++) {
                        cellsToToggle[i].mComponent.isActive = !this._limitReached;
                    }
                }
            }, 100);
        }

        /**
         * @param {Number} step The zoom step index
         * @returns {void}
         */
        set zoomStep(step) {
            step = parseInt(step);

            if (isNaN(step)) {
                step = 0;
            }

            if (step >= AlbumTimeline.zoomSteps.length || step < 0) {
                return;
            }

            this.el.classList.remove(`album-timeline-zoom-${this._zoomStep}`);
            this._zoomStep = step;
            this.el.classList.add(`album-timeline-zoom-${step}`);

            if (!this.skipGlobalZoom) {
                globalZoomStep = step;
            }

            if (this.dynamicList && this._nodes.length) {
                this.nodes = this._nodes.map(({ list }) => list).flat();
            }
        }

        /**
         * @param {MegaNode[]} nodes The new list of nodes to use
         * @returns {void}
         */
        set nodes(nodes) {
            let $middleBlock;

            if (this.dynamicList) {
                $middleBlock = this.findMiddleImage();
                this.dynamicList.destroy();
                this.dynamicList = null;
            }

            MComponent.resetSubElements(this, '_nodes', false);

            if (!nodes.length) {
                return;
            }

            this.setCellSize();

            this.dynamicList = new MegaDynamicList(this.el, {
                itemRenderFunction: this.renderRow.bind(this),
                itemHeightCallback: () => this.rowHeight,
                onResize: this.onResize.bind(this),
                perfectScrollOptions: {
                    handlers: ['click-rail', 'drag-thumb', 'wheel', 'touch'],
                    minScrollbarLength: 50
                }
            });

            const ids = [];
            let lastIndex = 0;
            let monthLabel = getMonthLabel(nodes[0]);
            this.rowIndexCache[nodes[0].h] = 0;
            this._nodes.push({
                list: [nodes[0]],
                monthLabel
            });

            for (let i = 1; i < nodes.length; i++) {
                const node = nodes[i];
                const lastEl = this._nodes[lastIndex];
                const curLabel = getMonthLabel(node);

                if (this.showMonthLabel && curLabel !== monthLabel) {
                    ids.push(lastIndex.toString());
                    monthLabel = curLabel;
                    lastIndex++;

                    this._nodes.push({
                        list: [node],
                        monthLabel
                    });
                }
                else if (lastEl.list.length % AlbumTimeline.zoomSteps[this.zoomStep] === 0) {
                    ids.push(lastIndex.toString());
                    lastIndex++;

                    this._nodes.push({
                        list: [node]
                    });
                }
                else {
                    lastEl.list.push(node);
                }

                this.rowIndexCache[node.h] = lastIndex;
            }

            if (!this.dynamicList.items[lastIndex]) {
                ids.push(lastIndex.toString());
            }

            this.dynamicList.batchAdd(ids);
            this.dynamicList.initialRender();

            if (this.zoomControls) {
                this.el.parentNode.prepend(this.zoomControls);
            }

            if ($middleBlock) {
                const listContainerHeight = this.el.offsetHeight;
                const blockSize = $('.album-timeline-cell', this.el).width();
                const rowIndex = this.rowIndexCache[$middleBlock.attr('id')];
                const newOffsetTop = this.dynamicList._offsets[rowIndex];
                this.dynamicList.scrollToYPosition(newOffsetTop - (listContainerHeight - blockSize) / 2);
            }

            delay('album_timeline:set_nodes', () => {
                if (this.dynamicList) {
                    this.dynamicList.options.onResize = this.onResize.bind(this);
                }
            });
        }

        findMiddleImage() {
            const $blockViews = $('.album-timeline-cell', this.el);
            const contentOffset = $('.MegaDynamicList-content', this.el).offset();
            const listContainerHeight = this.el.offsetHeight;

            let middleBlock = null;
            let minDistance = 1e6;

            const { scrollTop } = this.el;

            for (const v of $blockViews) {
                const $v = $(v);

                if ($v.offset().left < contentOffset.left + 5) {
                    const blockSize = $v.width();
                    const blockTop = $v.offset().top - contentOffset.top - parseInt($v.css('margin-top'));
                    const middle = blockTop + blockSize / 2 - scrollTop;
                    const distance = Math.abs(listContainerHeight / 2 - middle);

                    if (distance < minDistance) {
                        minDistance = distance;
                        middleBlock = $v;
                    }
                }
            }

            return middleBlock;
        }

        clearSiblingSelections(ignoreHandle) {
            const handles = Object.keys(this.selections);

            for (let i = 0; i < handles.length; i++) {
                if (handles[i] !== ignoreHandle) {
                    this.deselectNode(M.d[handles[i]]);
                }
            }
        }

        attachEvents() {
            this.onNodeClick = (cell, evt) => {
                const { shiftKey } = evt;
                const { el, isSelected } = cell;

                if (this.selectionLimit === 1) {
                    this.selectNode(el.ref.node);
                    this.clearSiblingSelections(el.ref.node.h);
                    return;
                }

                this.lastNavNode = el.ref.node;

                if (shiftKey) {
                    if (this.selectStartNode && this.selectStartNode.h !== el.ref.node.h) {
                        this.selectElementsRange(this.selectStartNode, el.ref.node, true);
                    }
                    else {
                        this.clearSiblingSelections(el.ref.node.h);
                        this.selectStartNode = el.ref.node;
                    }
                }
                else {
                    if (isSelected) {
                        this.deselectNode(el.ref.node);
                        this.selectStartNode = null;
                        this.lastNavNode = null;
                    }
                    else {
                        this.selectNode(el.ref.node);
                        this.selectStartNode = el.ref.node;
                    }

                    this.shiftSelectedIndexes = [];
                }
            };

            this.onNodeDbClick = (cell, evt) => {
                this.selectStartNode = cell.el.ref.node;
                this.lastNavNode = null;

                if (this.onDoubleClick) {
                    this.onDoubleClick(cell, evt);
                }
            };

            this.attachKeyboardListener();

            if (this.selectionLimit !== 1) {
                this.attachDragListener();
            }
        }

        selectNonRenderedCells(posArr) {
            for (let i = 0; i < this._nodes.length; i++) {
                for (let j = 0; j < this._nodes[i].list.length; j++) {
                    const isInArea = scope.isInSelectArea(
                        {
                            offsetLeft: Math.floor(
                                this.cellSize * j + scope.cellMargin * (j * 2 + 1)
                            ),
                            offsetTop: Math.floor(
                                this.dynamicList._offsets[i.toString()] + scope.cellMargin
                            ),
                            offsetWidth: this.cellSize,
                            offsetHeight: this.cellSize
                        },
                        posArr,
                        this.sidePadding
                    );

                    if (isInArea) {
                        this.selectNode(this._nodes[i].list[j]);
                    }
                    else {
                        this.deselectNode(this._nodes[i].list[j]);
                    }
                }
            }
        }

        selectRenderedCells(posArr) {
            const keys = Object.keys(this.dynamicList._currentlyRendered);

            if (keys.length) {
                for (let i = 0; i < keys.length; i++) {
                    const row = this.dynamicList._currentlyRendered[keys[i]];

                    if (row.children && row.children.length) {
                        for (let j = 0; j < row.children.length; j++) {
                            if (scope.isInSelectArea(row.children[j], posArr, this.sidePadding)) {
                                this.selectNode(row.children[j].ref.node);
                                this.lastNavNode = row.children[j].ref.node;
                            }
                            else {
                                this.deselectNode(row.children[j].ref.node);
                            }
                        }
                    }
                }
            }
        }

        attachDragListener() {
            let initX = 0;
            let initY = 0;

            this.dragSelect = new mega.ui.dragSelect(
                this.el,
                {
                    allowedClasses: ['MegaDynamicListItem'],
                    onDragStart: (xPos, yPos) => {
                        initX = xPos;
                        initY = this.dynamicList.getScrollTop() + yPos;
                        $.hideContextMenu();
                    },
                    onDragMove: (xPos, yPos) => {
                        const posArr = [];

                        yPos += this.dynamicList.getScrollTop();

                        if (xPos > initX) {
                            posArr.push(initX, xPos);
                        }
                        else {
                            posArr.push(xPos, initX);
                        }

                        if (yPos > initY) {
                            posArr.push(initY, yPos);
                        }
                        else {
                            posArr.push(yPos, initY);
                        }

                        this.selectArea = posArr;

                        if (this.dynamicList) {
                            this.selectRenderedCells(posArr);

                            delay('album_timeline:drag_select', () => {
                                this.selectNonRenderedCells(posArr);
                            }, 50);
                        }
                    },
                    onDragEnd: (wasDragging, yCorrection, rect, { target }) => {
                        if (!wasDragging
                            && this.selCount
                            && (target === this.el || target.classList.contains('MegaDynamicListItem'))) {
                            this.clearSiblingSelections();
                            this.selectArea = null;
                            this.lastNavNode = null;
                        }

                        this.selectStartNode = null;
                        this.shiftSelectedIndexes = [];
                    },
                    onScrollUp: () => {
                        if (!this.limitReached) {
                            this.dynamicList.scrollToYPosition(this.dynamicList.getScrollTop() - 20);
                        }
                    },
                    onScrollDown: () => {
                        if (!this.limitReached) {
                            this.dynamicList.scrollToYPosition(this.dynamicList.getScrollTop() + 20);
                        }
                    },
                    getOffsetTop: () => this.dynamicList.getScrollTop()
                }
            );
        }

        resetLastNavNode(shiftKey) {
            if (!this.lastNavNode) {
                if (this.selectStartNode) {
                    this.lastNavNode = this.selectStartNode;
                    return;
                }

                const selections = Object.keys(this.selections);

                if (selections.length) {
                    this.lastNavNode = M.d[selections[selections.length - 1]];
                }
            }

            if (shiftKey && !this.selectStartNode) {
                this.selectStartNode = this.lastNavNode || this._nodes[0].list[0];
            }
        }

        attachKeyboardListener() {
            if (scope.disposeKeyboardEvents) {
                scope.disposeKeyboardEvents();
            }

            scope.disposeKeyboardEvents = MComponent.listen(document, 'keydown', (evt) => {
                if (evt.target !== document.body) {
                    return;
                }

                const { key, shiftKey } = evt;
                const isCtrl = scope.getCtrlKeyStatus(evt);

                let rowIndex = -1;
                let inRowIndex = -1;
                let skipSelfSelect = false;

                this.resetLastNavNode(shiftKey);

                if (this.lastNavNode) {
                    rowIndex = this.rowIndexCache[this.lastNavNode.h];

                    inRowIndex = this._nodes[this.rowIndexCache[this.lastNavNode.h]].list
                        .findIndex(({ h }) => h === this.lastNavNode.h);
                }
                else {
                    rowIndex++;
                }

                const events = {
                    ArrowLeft: () => {
                        inRowIndex--;

                        if (inRowIndex < 0) {
                            rowIndex--;
                            inRowIndex = AlbumTimeline.zoomSteps[this.zoomStep] - 1;
                        }

                        if (rowIndex < 0 && !shiftKey && !isCtrl) {
                            rowIndex = this._nodes.length - 1;
                        }

                        if (this._nodes[rowIndex] && inRowIndex >= this._nodes[rowIndex].list.length) {
                            inRowIndex = this._nodes[rowIndex].list.length - 1;
                        }
                    },
                    ArrowRight: () => {
                        inRowIndex++;

                        if (inRowIndex >= this._nodes[rowIndex].list.length) {
                            rowIndex++;
                            inRowIndex = 0;
                        }

                        if (rowIndex >= this._nodes.length && !shiftKey && !isCtrl) {
                            rowIndex = 0;
                        }
                    },
                    ArrowUp: () => {
                        if (this.lastNavNode) {
                            rowIndex--;
                        }
                        else {
                            rowIndex = 0;
                            inRowIndex = 0;
                        }

                        if (rowIndex < 0 && !shiftKey && !isCtrl) {
                            rowIndex = this._nodes.length - 1;
                        }

                        if (!this._nodes[rowIndex]) {
                            return true;
                        }

                        const perRow = this._nodes[rowIndex].list.length;

                        if (inRowIndex >= perRow) {
                            inRowIndex = perRow - 1;
                        }

                        if (this.selectionLimit > 1 && !this.limitReached) {
                            const overLimit = this.selCount + perRow - this.selectionLimit;

                            if (overLimit > 0) {
                                inRowIndex += overLimit;

                                if (inRowIndex >= perRow) {
                                    rowIndex++;
                                    inRowIndex = perRow - inRowIndex;
                                }
                            }
                        }
                    },
                    ArrowDown: () => {
                        if (this.lastNavNode) {
                            rowIndex++;
                        }
                        else {
                            rowIndex = 0;
                            inRowIndex = 0;
                        }

                        if (rowIndex >= this._nodes.length && !shiftKey && !isCtrl) {
                            rowIndex = 0;
                        }

                        if (!this._nodes[rowIndex]) {
                            return true;
                        }

                        const perRow = this._nodes[rowIndex].list.length;

                        if (this._nodes[rowIndex] && inRowIndex >= perRow) {
                            inRowIndex = perRow - 1;
                        }

                        if (this.selectionLimit > 1 && !this.limitReached) {
                            const overLimit = this.selCount + perRow - this.selectionLimit;

                            if (overLimit > 0) {
                                inRowIndex -= overLimit;
                                if (inRowIndex < 0) {
                                    rowIndex--;
                                    inRowIndex = perRow + inRowIndex;
                                }
                            }
                        }
                    },
                    a: () => {
                        if (this.selectionLimit === 1) {
                            return true;
                        }

                        for (let i = 0; i < this._nodes.length; i++) {
                            for (let j = 0; j < this._nodes[i].list.length; j++) {
                                this.selectNode(this._nodes[i].list[j]);
                            }
                        }

                        this.lastNavNode = null;
                        skipSelfSelect = true;
                    },
                    Escape: () => {
                        if ($.dialog) {
                            if ($.dialog === 'm-dialog') {
                                scope.disposeKeyboardEvents();
                                scope.disposeKeyboardEvents = null;
                            }

                            evt.preventDefault();
                            evt.stopPropagation();
                            closeDialog();
                        }

                        return true;
                    },
                    Enter: () => {
                        evt.preventDefault();
                        evt.stopPropagation();

                        if ($.dialog) {
                            scope.disposeKeyboardEvents();
                            scope.disposeKeyboardEvents = null;
                            return true;
                        }

                        if (!this.selCount) {
                            return true;
                        }

                        if (this.selCount === 1) {
                            scope.playSlideshow(scope.getAlbumIdFromPath());
                        }
                        else {
                            scope.reportDownload();
                            M.addDownload(Object.keys(this.selections));
                        }

                        return true;
                    }
                };

                if (!events[key]) {
                    return;
                }

                if (isCtrl) {
                    evt.preventDefault();
                    evt.stopPropagation();
                }

                if (events[key]() === true
                    || rowIndex < 0
                    || rowIndex >= this._nodes.length
                    || !this._nodes[rowIndex]
                    || !this._nodes[rowIndex].list[inRowIndex]
                ) {
                    return true;
                }

                this.lastNavNode = this._nodes[rowIndex].list[inRowIndex];

                if (skipSelfSelect || !this.cellCache[this.lastNavNode.h]) {
                    return;
                }

                const performSelection = () => {
                    const { el } = this.cellCache[this.lastNavNode.h];

                    if (shiftKey) {
                        this.selectElementsRange(this.selectStartNode, this.lastNavNode);
                    }
                    else if (!isCtrl || !el.mComponent.isSelected) {
                        this.selectNode(this.lastNavNode);
                    }

                    this.scrollToSelectedRow(rowIndex);

                    if (!shiftKey && !isCtrl) {
                        this.clearSiblingSelections(this.lastNavNode.h);
                    }
                };

                performSelection();
            });
        }

        scrollToSelectedRow(rowIndex) {
            const newOffsetTop = this.dynamicList._offsets[rowIndex];
            const scrollTop = this.dynamicList.getScrollTop();

            if (newOffsetTop < scrollTop) {
                this.dynamicList.scrollToYPosition(newOffsetTop);
            }
            else {
                const bottomOverflow = newOffsetTop
                    + this.rowHeight
                    + scope.cellMargin
                    - (scrollTop + this.el.clientHeight);

                if (bottomOverflow > 0) {
                    this.dynamicList.scrollToYPosition(scrollTop + bottomOverflow);
                }
            }
        }

        /**
         * @param {Meganode} node Node to select
         * @returns {void}
         */
        selectNode(node) {
            if (this.limitReached) {
                if (!this.limitTip) {
                    this.addCountLimitTip();
                }

                return;
            }

            if (!this.selections[node.h]) {
                this.selections[node.h] = true;

                if (this.onSelectToggle) {
                    this.onSelectToggle(node);
                }

                const cell = this.cellCache[node.h];

                if (cell) {
                    cell.isSelected = true;
                }

                this._selCount++;

                if (
                    this.selectionLimit > 1
                    && this.selCount >= this.selectionLimit
                ) {
                    this.addCountLimitTip();
                    this.limitReached = true;
                }

                this.adjustHeader();
            }
        }

        /**
         * @param {Meganode} node Node to deselect
         * @returns {void}
         */
        deselectNode(node) {
            if (this.selections[node.h]) {
                delete this.selections[node.h];

                if (this.onSelectToggle) {
                    this.onSelectToggle(node);
                }

                const cell = this.cellCache[node.h];

                if (cell) {
                    cell.isSelected = false;
                }

                this.adjustToBottomBar();

                this._selCount--;

                if (
                    this.limitReached
                    && this.selCount < this.selectionLimit
                ) {
                    this.removeCountLimitTip();
                    this.limitReached = false;
                }

                this.adjustHeader();
            }
        }

        addCountLimitTip() {
            if (this.limitTip) {
                return;
            }

            this.limitTip = document.createElement('div');
            this.limitTip.className = 'absolute bottom-0 right-0 w-full tooltip-popin timeline-tooltip';

            const icon = document.createElement('i');
            const message = document.createElement('span');
            const button = document.createElement('button');
            icon.className = 'sprite-fm-uni icon-hazard mr-4 icon-size-6';
            message.className = 'flex-1';
            message.textContent = mega.icu.format(l.album_items_limit, scope.maxSelectionsCount);
            button.textContent = l[81];

            const flex = document.createElement('div');
            flex.className = 'w-full flex flex-row items-center bg-surface-main rounded-2xl p-4';
            flex.appendChild(icon);
            flex.appendChild(message);
            flex.appendChild(button);
            this.limitTip.appendChild(flex);

            this.attachEvent(
                'click.hideSelectionLimit',
                () => {
                    this.removeCountLimitTip();
                },
                null,
                button
            );

            this.el.parentNode.appendChild(this.limitTip);
        }

        removeCountLimitTip() {
            if (this.limitTip) {
                this.disposeEvent('click.hideSelectionLimit');
                this.el.parentNode.removeChild(this.limitTip);
                delete this.limitTip;
            }
        }

        onResize() {
            if (this.dynamicList) {
                this.setCellSize();

                const keys = Object.keys(this.dynamicList._currentlyRendered);

                for (let i = 0; i < keys.length; i++) {
                    this.dynamicList.itemChanged(keys[i]);
                }
            }
        }

        setCellSize() {
            const gap = 8;

            this.cellSize = (this.el.offsetWidth
                - gap * AlbumTimeline.zoomSteps[this.zoomStep] // Cell margins
                - this.sidePadding * 2) // Horizontal padding
                / AlbumTimeline.zoomSteps[this.zoomStep]; // Columns
        }

        /**
         * Preparing and caching the cell result for the future use
         * @param {MegaNode} node Node to use for building the cell
         * @returns {AlbumTimelineCell}
         */
        getCachedCell(node) {
            if (!this.cellCache[node.h]) {
                this.cellCache[node.h] = new AlbumTimelineCell({
                    node,
                    clickFn: this.onNodeClick,
                    dbclickFn: this.onNodeDbClick,
                    useMenu: this.interactiveCells
                });
            }

            return this.cellCache[node.h];
        }

        renderRow(rowKey) {
            const div = document.createElement('div');
            div.className = 'flex flex-row';

            const toFetchAttributes = [];

            if (this._nodes[rowKey]) {
                const sizePx = `${this.cellSize}px`;
                const { list, monthLabel } = this._nodes[rowKey];

                for (let i = 0; i < list.length; i++) {
                    const tCell = this.getCachedCell(list[i]);
                    const preSize = tCell.naturalSize || 0;

                    tCell.el.style.width = sizePx;
                    tCell.el.style.height = sizePx;
                    scope.setShimmering(tCell.el);

                    if (this.showMonthLabel && !i && monthLabel) {
                        tCell.applyMonthLabel(monthLabel);
                    }
                    else {
                        tCell.removeMonthLabel();
                    }

                    if (this.selections[list[i].h]) {
                        tCell.isSelected = true;
                    }

                    tCell.isActive = !this.limitReached || tCell.isSelected;

                    div.appendChild(tCell.el);
                    fillAlbumTimelineCell(tCell.el);

                    tCell.el.ref.el = tCell.el;

                    if (parseFloat(preSize) < parseFloat(tCell.el.style.width)) {
                        toFetchAttributes.push(tCell.el.ref);
                    }
                }
            }

            if (toFetchAttributes.length) {
                delay(`album_timeline:render_row${rowKey}`, () => MegaGallery.addThumbnails(toFetchAttributes));
            }

            return div;
        }

        /**
         * Selecting all nodes in between
         * @param {MegaNode} nodeA First node in the range
         * @param {MegaNode} nodeB Last node in the range
         * @param {Number} direction Selecting as 1 (from left to right) or -1 (from right to left)
         * @returns {void}
         */
        selectElementsRange(nodeA, nodeB) {
            const nodes = this._nodes.map(({ list }) => list).flat();
            let indexA = false;
            let indexB = false;
            const newIndexes = [];

            for (let i = 0; i < nodes.length; i++) {
                const { h } = nodes[i];

                if (h === nodeA.h) {
                    indexA = i;

                    if (nodeA.h === nodeB.h) {
                        indexB = i;
                    }
                }
                else if (h === nodeB.h) {
                    indexB = i;
                }

                if (indexA !== false && indexB !== false) {
                    break;
                }
            }

            if (indexA > indexB) {
                indexA += indexB;
                indexB = indexA - indexB;
                indexA -= indexB;
            }

            for (let i = indexA; i <= indexB; i++) {
                this.selectNode(nodes[i]);
                newIndexes.push(i);
            }

            for (let i = 0; i < this.shiftSelectedIndexes.length; i++) {
                if (!newIndexes.includes(this.shiftSelectedIndexes[i])) {
                    this.deselectNode(nodes[this.shiftSelectedIndexes[i]]);
                }
            }

            this.shiftSelectedIndexes = newIndexes;
        }

        adjustHeader() {
            delay('album_timeline:render_header', () => {
                albums.grid.header.update(scope.getAlbumIdFromPath(), Object.keys(this.selections));
            }, 100);
        }

        adjustToBottomBar() {
            delay(
                'album_timeline:adjusting_to_bottom_bar',
                () => {
                    if (this.interactiveCells) {
                        this.el.style.height = (this.selCount) ? 'calc(100% - 65px)' : null;
                        this.el.style.minHeight = (this.selCount) ? '280px' : null;
                        this.resizeDynamicList();
                        Ps.update(this.el);
                    }
                },
                50
            );
        }

        resizeDynamicList() {
            if (this.dynamicList) {
                const prevScrollTop = this.dynamicList.getScrollTop();

                this.dynamicList.resized();
                this.dynamicList.scrollToYPosition(prevScrollTop);
            }
        }

        debouncedResize() {
            delay(
                'album_timeline:resize',
                () => {
                    this.resizeDynamicList();
                },
                100
            );
        }

        setZoomControls() {
            if (this.zoomControls) {
                return;
            }

            this.zoomControls = document.createElement('div');
            this.zoomControls.className = 'gallery-view-zoom-control';

            const buttons = [
                {
                    tooltip: l[24927],
                    classes: 'zoom-out',
                    icon: 'icon-minimise',
                    clickFn: () => {
                        this.zoomStep--;
                    },
                    checkIfDisabled: () => this.zoomStep <= 0
                },
                {
                    tooltip: l[24928],
                    classes: 'zoom-in',
                    icon: 'icon-add',
                    clickFn: () => {
                        this.zoomStep++;
                    },
                    checkIfDisabled: () => this.zoomStep >= AlbumTimeline.zoomSteps.length - 1
                }
            ];

            for (let i = 0; i < buttons.length; i++) {
                const { icon, clickFn, tooltip, classes, checkIfDisabled } = buttons[i];

                const btn = document.createElement('button');
                btn.className = `btn-icon simpletip ${classes}`;
                btn.dataset.simpletip = tooltip;
                const iconEl = document.createElement('i');
                iconEl.className = `sprite-fm-mono ${icon}`;
                btn.appendChild(iconEl);
                btn.onclick = () => {
                    clickFn();

                    if (checkIfDisabled()) {
                        btn.disabled = true;
                        btn.classList.add('disabled');
                    }

                    const sibling = btn.nextElementSibling || btn.previousElementSibling;

                    if (sibling && sibling.disabled) {
                        sibling.disabled = false;
                        sibling.classList.remove('disabled');
                    }
                };

                this.zoomControls.appendChild(btn);

                if ((!i && !this.zoomStep)
                    || (i === buttons.length - 1 && this.zoomStep === AlbumTimeline.zoomSteps.length - 1)) {
                    btn.disabled = true;
                    btn.classList.add('disabled');
                }
            }

            this.el.parentNode.prepend(this.zoomControls);
        }

        buildElement() {
            this.el = document.createElement('div');
        }

        clear() {
            this.selections = {};

            if (this.dynamicList) {
                this.dynamicList.destroy();
                this.dynamicList = null;
            }

            if (this.zoomControls) {
                if (this.el.parentNode) {
                    this.el.parentNode.removeChild(this.zoomControls);
                }

                this.zoomControls = null;
            }

            if (this.dragSelect) {
                this.dragSelect.dispose();
            }

            if (scope.disposeKeyboardEvents) {
                scope.disposeKeyboardEvents();
                scope.disposeKeyboardEvents = null;
            }

            if (this.el && this.el.parentNode) {
                this.el.parentNode.removeChild(this.el);
            }
        }
    }

    AlbumTimeline.zoomSteps = [15, 10, 5, 3];
    return AlbumTimeline;
});

/**
 * This file handles the Notification Banner, which appears on the user's
 * Dashboard, CD, and Photos pages below the top navigation menu. One banner
 * will be shown at a time (the oldest first, if multiple notifications exist).
 * Once a user has closed the banner or clicked a CTA button, it will be marked
 * as actioned on the API server, and another banner will be shown if possible.
 */
var notificationBanner = {

    /** The id number of the last banner that the user has actioned */
    lastActionedBannerId: 0,

    /** The current notification being shown to the user */
    currentNotification: null,

    /** Whether the banner system has been inited or not */
    bannerInited: false,

    /** Whether the event for dismissing the banner has been sent or not */
    sendDismissedEvent: false,

    /**
     * Check if there are any banners that can be shown to the user, and set the last actioned
     * banner ID variable
     * @returns {void}
     */
    async init() {
        'use strict';

        // Get the last actioned banner ID user attribute
        this.lastActionedBannerId
            = parseInt(await Promise.resolve(mega.attr.get(u_handle, 'lbannr', -2, true)).catch(nop)) | 0;

        // Show the banner
        this.configureAndShowBanner();

        this.bannerInited = true;
    },

    /**
     * Wrapper function to configure the banner details and show it
     * @returns {Boolean} whether a banner can be shown or not
     */
    configureAndShowBanner() {
        'use strict';

        // Iterate through list of notifications to find earliest banner to show
        for (const key in notify.dynamicNotifs) {
            if (notify.dynamicNotifs[key]) {
                const notification = notify.dynamicNotifs[key];
                const notifIsActive = notification.e - unixtime() > 0;

                if (this.lastActionedBannerId < notification.id && notification.sb && notifIsActive) {
                    this.currentNotification = notification;

                    if (this.prefillBannerDetails()) {
                        if (!this.bannerPcListener || !this.bannerMultiTabsListener) {
                            this.addBroadcastListeners();
                        }

                        this.showBanner(true);

                        // Add a handler to fix the layout if the window is resized
                        $(window).rebind('resize.notifBanner', () => {
                            this.updateFMContainerHeight(true);
                        });

                        return true;
                    }
                }
            }
        }

        this.updateFMContainerHeight(false);

        delete this.currentNotification;
        return false;
    },

    /**
     * Update the details of the banner
     * @returns {Boolean} whether banner integrity is ok or not
     */
    prefillBannerDetails() {
        'use strict';

        const title = this.currentNotification.t;
        const description = this.currentNotification.d;

        let primaryButtonLabel;
        if (this.currentNotification.cta1) {
            primaryButtonLabel = this.currentNotification.cta1.text;
        }

        let secondaryButtonLabel;
        if (this.currentNotification.cta2) {
            secondaryButtonLabel = this.currentNotification.cta2.text;
        }

        if (!this.$banner) {
            this.$banner = $('.notification-banner');
        }

        if (!title || !description || !this.$banner.length) {
            return false;
        }

        // Populate the details
        $('.title', this.$banner).text(title);
        $('.message', this.$banner).text(description);

        const $primaryButton = $('.cta-primary', this.$banner);
        const $secondaryButton = $('.cta-secondary', this.$banner);

        $primaryButton.toggleClass('hidden', !this.currentNotification.cta1.link);
        if (this.currentNotification.cta1.link) {
            $primaryButton
                .attr('data-continue-link', this.currentNotification.cta1.link)
                .text(primaryButtonLabel);
        }

        $secondaryButton.toggleClass('hidden', !this.currentNotification.cta2.link);
        if (this.currentNotification.cta2.link) {
            $secondaryButton
                .attr('data-continue-link', this.currentNotification.cta2.link)
                .text(secondaryButtonLabel);
        }

        // Add event handlers for the buttons
        $('button.cta-primary, button.cta-secondary', this.$banner).rebind('click.bannerCtaBtns', (e) => {
            const pageLink = $(e.currentTarget).attr('data-continue-link');

            if (pageLink) {
                // If a link exists, open it in a new tab
                window.open(pageLink, '_blank', 'noopener,noreferrer');
            }
            else {
                // Otherwise, mark the banner as actioned
                this.markBannerAsActioned();
            }
        });
        $('.close.js-close', this.$banner).rebind('click.bannerClose', () => {
            this.sendDismissedEvent = true;
            this.markBannerAsActioned();
        });

        const $displayIcon = $('.display-icon', this.$banner).addClass('hidden');

        const icon = this.currentNotification.icon;
        if (icon) {
            // Determine icon path
            const retina = window.devicePixelRatio > 1 ? '@2x' : '';
            const imagePath = `${staticpath}images/mega/psa/${icon + retina}.png`;
            let failed = false;

            $displayIcon
                .attr('src', imagePath)
                .rebind('error.bannerImage', function() {
                    // If it failed once it will likely keep failing, prevent infinite loop
                    if (failed) {
                        $(this).addClass('hidden');
                        return;
                    }

                    $(this).attr('src', `${notificationBanner.currentNotification.dsp + icon + retina}.png`);
                    failed = true;
                })
                .rebind('load.bannerImage', function() {
                    $(this).removeClass('hidden');
                });
        }

        return true;
    },

    /**
     * Function to mark a banner as actioned, and to notify any open tabs of this.
     * @returns {void}
     */
    markBannerAsActioned() {
        'use strict';

        // Notify any other tabs a banner has been closed
        mBroadcaster.crossTab.notify('closedBanner', this.currentNotification.id);

        // Store that the user has actioned this banner on the API side
        // (as ^!lbannr for a private, non encrypted, non historic attribute)
        mega.attr.set('lbannr', String(this.currentNotification.id), -2, true);

        this.updateBanner(true);
    },

    /**
     * Attempt to show the banner and toggle some classes if required
     * @param {Boolean} [sendBannerShownEvent] Whether to send an event when the banner is shown.
     * @returns {void}
     */
    showBanner(sendBannerShownEvent) {
        'use strict';

        const isValidBannerPage = !M.chat && M.currentdirid !== 'refer'
            && !String(M.currentdirid).includes('account');

        if (isValidBannerPage) {
            delay('update-banner-classes', () => {
                const onDashboardPage =  M.currentdirid === 'dashboard';

                this.$banner.removeClass('hidden')
                    .toggleClass('no-max-width', !onDashboardPage)
                    .toggleClass('extra-bottom-padding', $('.onboarding-control-panel').is(':visible'));

                // Move the banner in the DOM if:
                // (1) the user navigates to the dashboard page (banner must be fixed there), or
                // (2) it has been moved before (move it back to its original position)
                if (onDashboardPage) {
                    this.$banner.insertBefore($('.widgets.content-block', '.fm-right-block.dashboard'));
                }
                else {
                    this.$banner.insertAfter($('#topmenu'));
                }

                this.updateFMContainerHeight(true);
            }, 30);

            if (sendBannerShownEvent) {
                eventlog(500239, this.currentNotification.id | 0);
            }
        }
    },

    /**
     * Resize the currently shown FM container to prevent the page contents being cut off at the bottom
     *
     * @param {Boolean} bannerShown if the banner is currently being shown
     * @returns {void}
     */
    updateFMContainerHeight(bannerShown) {
        'use strict';

        if (M.currentdirid === 'dashboard') {
            return;
        }

        let activeFMContainer = '.fm-right-files-block:not(.in-chat)';

        if (M.currentdirid === 'recents') {
            activeFMContainer = '.fm-recents.container';
        }
        else if (M.currentdirid === 'devices') {
            activeFMContainer = '.fm-right-block.full-size';
        }

        if (bannerShown) {
            if (M.currentdirid === 'albums') {
                $('.albums-grid', '#albums-view').height(`calc(100vh - 97px - ${this.$banner.outerHeight()}px)`);
            }
            else {
                $(activeFMContainer).height(`calc(100% - 48px - ${this.$banner.outerHeight()}px)`);

                // If a gallery empty state is visible, add a scroller to it so the contents
                // can be seen
                const $emptySection = $('.fm-empty-section:not(.hidden)', $(activeFMContainer));

                if (M.currentCustomView &&
                        M.currentCustomView.type === 'gallery' &&
                        !$emptySection.hasClass('hidden')) {
                    Ps.initialize($emptySection[0]);
                }
            }
        }
        else {
            // Remove any custom height styles set
            $('.fm-right-files-block:not(.in-chat)').removeAttr('style');
            $('.fm-right-block.dashboard').removeAttr('style');
            $('.fm-recents.container').removeAttr('style');
            $('.fm-right-block.full-size').removeAttr('style');
            $('.albums-grid', '#albums-view').removeAttr('style');

            // Remove any scrollbars added
            const $emptySection = $('.fm-empty-section.ps');
            if ($emptySection) {
                Ps.destroy($emptySection[0]);
            }

            $(window).unbind('resize.notifBanner');
        }
    },

    /**
     * Add the broadcast listners for:
     * (1) showing/hiding the banner as appropriate when navigating between pages
     * (2) when multiple tabs are open and a banner is closed on one of them
     * @returns {void}
     */
    addBroadcastListeners() {
        'use strict';

        this.bannerPcListener = mBroadcaster.addListener('pagechange', () => {
            // Hide the notifications banner while the page change is finishing up.
            this.$banner.addClass('hidden');

            onIdle(() => this.showBanner(false));
        });

        this.bannerMultiTabsListener = mBroadcaster.addListener('crossTab:closedBanner', (key) => {
            if (this.currentNotification.id === key.data) {
                this.updateBanner(true);
            }
        });
    },

    /**
     * Function to attempt to show a new banner if possible.
     * @param {Boolean} [updateLastActioned] Whether to set the last actioned banner ID or not.
     * @returns {void}
     */
    updateBanner(updateLastActioned) {
        'use strict';

        if (updateLastActioned) {
            this.lastActionedBannerId = this.currentNotification.id;
        }
        this.$banner.addClass('hidden');

        if (this.sendDismissedEvent) {
            eventlog(500241, this.currentNotification.id | 0);
            this.sendDismissedEvent = false;
        }

        // If no more banners are available to be shown, remove the broadcast listeners and reset them
        if (!this.configureAndShowBanner()) {
            mBroadcaster.removeListener(this.bannerPcListener);
            mBroadcaster.removeListener(this.bannerMultiTabsListener);
            delete this.bannerPcListener;
            delete this.bannerMultiTabsListener;
        }
    }
};
