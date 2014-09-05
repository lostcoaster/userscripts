// ==UserScript==
// @name       SteamCN Notifier
// @namespace  http://lostcoaster.github.io/
// @version    0.1.3
// @author     lostcoaster
// @description  enter something useful
// @include    /http:\/\/steamcn\.com\/forum\.php.*/
// @grant      unsafeWindow
// @copyright  GPL license
// @require    https://ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js
// ==/UserScript==

"use strict";

var timer;
var scan_interval = 60 * 1000; //1分钟扫描间隔


/**
 * the options class
 * @constructor
 */
function Options() {
    // the keys and default values, note that the values are plain values (not JSON parsed)
    var options = {
        status: 0,
        email: '',
        last_check: 0,
        latest_post: 0,
        enabled_forums: [],
        api_key: 'TrPFSHUL5CSZGPg7I2OMZQ',
        special_users: [],
        is_blacklist: true,
        version: -1
    };
    for (var key in options) {
        if (!options.hasOwnProperty(key)) {
            continue
        }
        this[key] = {
            default_val: options[key],
            name: 'lc.steamcn.' + key,
            get: function () {
                var temp = localStorage.getItem(this.name);
                if (!temp) {
                    return this.default_val;
                } else {
                    return JSON.parse(temp);
                }
            },
            set: function (val) {
                localStorage.setItem(this.name, JSON.stringify(val))
            },
            remove: function () {
                localStorage.removeItem(this.name);
            }
        };
    }


    var temp;
    //upgrade from old version
    switch (this['version'].get()) {
        case -1:
            //vanilla version , no version memory
            if ((temp = localStorage.getItem('lc.notify_email')) != null) {
                this['email'].set(temp);
                localStorage.removeItem('lc.notify_email')
            }
            if ((temp = localStorage.getItem('lc.steamcn_notify_status')) != null) {
                this['status'].set(Number(temp));
                localStorage.removeItem('lc.steamcn_notify_status')
            }
            if ((temp = localStorage.getItem('lc.latest_post_id')) != null) {
                this['latest_post'].set(Number(temp));
                localStorage.removeItem('lc.latest_post_id')
            }
            localStorage.removeItem('lc.last_check');
            break;
    }
    //version 1 options
    this['version'].set(1);
}

var options = new Options();

function construct_setting_panel() {
    // setting some custom styles
    jQuery('<style>.lc-selected-forum !important{ border: 3px solid lightblue; }</style>').appendTo('head');

    // a long code , direct copypasta from the steamcn forum, yep.
    var panel = jQuery('<div id="lc-setting-panel" class="fwinmask" style="padding: 0 5px; position: fixed; z-index: 201; left: 632.5px; top: 286px;"><table cellpadding="0" cellspacing="0" class="fwin"><tbody><tr><td class="t_l"></td><td class="t_c"></td><td class="t_r"></td></tr><tr><td class="m_l"></td><td class="m_c"><h3 class="flb">调整推送器设置<span><a href="javascript:;" class="flbc" title="关闭">关闭</a></span></h3><div id="lc-panel-container"></div></td><td class="m_r"></td></tr><tr><td class="b_l"></td><td class="b_c"></td><td class="b_r"></td></tr></tbody></table></div>');
    panel.find('.flbc').click(function () {
        panel.remove();
    });
    // filling it with the parts
    var container = panel.find('#lc-panel-container');
    container.css('padding', '5px');
    var enable_container = jQuery('<div>推送功能: <label><input type="radio" name="lc-enable-switch" value="1">启用</label><label><input type="radio" name="lc-enable-switch" value="0">关闭</label></div>');
    enable_container.find('input[value="' + options.status.get() + '"]').prop('checked', 'true');
//    enable_container.find('input').change(function(e){
//        if(!e.target.checked) {return}
//        set_enable(e.target.value == '1');
//    });
    container.append(enable_container);
    var forum_list_container = jQuery('<div id="lc-forum-list"><ul class="pbl cl"><li count="0"></li><li count="1"></li><li count="2"></li></ul></div>');
    container.append(forum_list_container);
    var special_name_container = jQuery('<div><span>黑/白名单的用户名<br>一行一个</span><textarea style="float: left;"></textarea><label><input type="radio" name="lc-black-switch" value="1">黑名单</label><br><label><input type="radio" name="lc-black-switch" value="0">白名单</label></div>');
    special_name_container.find('input[value="' + (options.is_blacklist.get() ? 1 : 0) + '"]').prop('checked', 'true');
    special_name_container.find('textarea').val(options.special_users.get().join('\n'));
    container.append(special_name_container);
    var email_container = jQuery('<p><label>邮箱 (如果不需要邮箱推送, 就留空): <input></label></p>');
    email_container.find('input').val(options.email.get());
    container.append(email_container);
    var api_key_container = jQuery('<div><label>API Key (如果不知道那是什么, 就不要修改): <input></label></div>');
    api_key_container.find('input').val(options.api_key.get());
    container.append(api_key_container);
    var save_btn = jQuery('<div><button class="pn pnc y"><span>保存并应用更改</span></button></div>');
    save_btn.click(save_data);
    container.append(save_btn);

    var forum_data = jQuery('<div/>');
    var selected_forums = options.enabled_forums.get();
    /**
     * parse the retrieved data and store them in enclosure
     * @param data
     */
    function set_forum_data(data) {
        forum_data.html(data.childNodes[0].childNodes[0].textContent);

        forum_data.find('#fs_group').prepend('<li fid="common">常用版块</li>');
        //add class
        forum_data.find('div:eq(0) li').each(function (i, d) {
            if (forum_data.find('ul[id$="forum_' + d.getAttribute('fid') + '"]').length != 0) {
                d.className = 'pbsb';
            }
        });

        switch_forum(0);
    }

    /**
     * a callback handling forum name clicking
     * @param {number}dest_col
     * @param {string=}fid
     */
    function switch_forum(dest_col, fid) {
        var forum_list_container = jQuery('#lc-forum-list');
        var dataset;
        switch (dest_col) {
            case 0:
                dataset = forum_data.find('#fs_group>li');
                break;
            case 1:
                dataset = forum_data.find('#fs_forum_' + fid + '>li');
                break;
            case 2:
                dataset = forum_data.find('#fs_subforum_' + fid + '>li');
                break;
            default:
                return;
        }
        forum_list_container.find('li:gt(' + (dest_col - 1) + ')').empty();
        var target = forum_list_container.find('li').eq(dest_col);
        jQuery.map(dataset, function (d) {
            var inserting_holder = jQuery('<p><a href="javascript:;"></a></p>');
            var inserting = inserting_holder.find('a');
            if(d.className){
                inserting.addClass(d.className);
            }
            if(selected_forums.indexOf(d.getAttribute('fid')) > -1){
                // in the previous setting
                inserting.addClass('lc-seleced-forum');
            }
            inserting.attr('fid', d.getAttribute('fid'));
            inserting.text(d.innerText);
            target.append(inserting_holder);
        });
        // the clicking handler
        target.find('a').click(function (e) {
            var elem_fid = e.target.getAttribute('fid');

            if (e.target.parentNode.className && elem_fid != 'common') { // remember the non forum collection
                // if already select, toggle it in the list
                var index = selected_forums.indexOf(elem_fid);
                if(index != -1){
                    jQuery(e.target).removeClass('lc-selected-forum');
                    selected_forums.splice(index,1); // delete
                } else {
                    jQuery(e.target).addClass('lc-selected-forum');
                    selected_forums.push(elem_fid); // add
                }
            } else {
                // otherwise just select
                jQuery('.pbls').removeClass('pbls');
                e.target.parentNode.className = 'pbls';
            }

            switch_forum(Number(e.target.parentNode.parentNode.getAttribute('count')) + 1, elem_fid);
        });
    }

    /**
     * the callback handling save configuration data
     */
    function save_data() {
        options.status.set(Number(enable_container.find('input:checked').val()));
        options.enabled_forums.set(selected_forums);
        var temp = special_name_container.find('textarea').text().split('\n');
        temp = jQuery.map(temp, function(d){return jQuery.trim(d)}).filter(function(d){return d});
        options.special_users.set(temp);
        options.is_blacklist.set(special_name_container.find('input:checked').val() == '1');
        temp = jQuery.trim(email_container.find('input').text());
        temp = temp ? temp:'-';
        options.email.set(temp);
        options.api_key.set(api_key_container.find('input').text());
        location.reload(); // refresh
    }


    jQuery.get('http://steamcn.com/forum.php?mod=misc&action=nav&infloat=yes&handlekey=nav&inajax=1&ajaxtarget=fwin_content_nav')
        .done(set_forum_data);

    jQuery('body').append(panel);
}

/**
 * send emails
 * @param {object[]}contents
 */
function send_email(contents) {
    return; //todo
    var email = options.email.get();
    if (!email || email == '-') {
        return; // not to send
    }

    var html_content = '<img src="http://steamcn.com/template/steamcn_metro/src/img//logo_sc.png" alt="SteamCN 蒸汽动力" border="0">' +
        jQuery.map(contents, function (data) {
            return '<p><a href="' + data.link + '">' + data.title + '</a></p><p>' + data.detail + '</p>'
        }).join('<br><br>');
    var text_content = '以下是推送内容: \n\n' +
        jQuery.map(contents, function (data) {
            return data.title + '\n' + data.detail + '\n' + data.link;
        }).join('\n');
    var req_data = {
        "key": options.api_key.get(),
        "message": {
            "html": html_content,
            "text": text_content,
            "subject": "SteamCN有一个新帖子",
            "from_email": "lostcoaster@steamcn.com",
            "from_name": "SteamCN Unofficial Notifier",
            "to": [
                {
                    "email": email,
                    "name": "SteamCN User",
                    "type": "to"
                }
            ],
            "headers": {
                "Reply-To": "lostcoaster@steamcn.com"
            },
            "important": false,
            "merge": true,
            "tags": [
                "steamcn-notify"
            ],
            "metadata": {
                "website": "www.steamcn.com"
            }
        },
        "async": false
    };

    jQuery.ajax({
        type: 'POST',
        url: 'https://mandrillapp.com/api/1.0/messages/send.json',
        data: req_data
    })
        .done(function (d) {
            console.debug('Email sent, response -- ' + d)
        })
        .fail(function () {
            console.error('Email sending failed')
        })
}

function check_for_post() {
    var parser = new DOMParser();

    //avoid multiple tabs check simultaneously, resulting some confusing results.
    var now = (new Date()).getTime();
    if (now - options.last_check.get() <= scan_interval / 2) {
        // there will be one stopping
        return;
    } else {
        options.last_check.set(now);
    }

    jQuery.get('http://steamcn.com/forum.php?mod=guide&view=newthread').done(function (data) {
        var page = jQuery(parser.parseFromString(data, 'text/html'));
        var found_post = [];
        var max_id = 0;
        page.find('tbody[id]').each(function (i, d) {
            var entry = jQuery(d);
            var entry_id = Number(entry.attr('id').match(/\d+/)[0]);
            var entry_link = entry.find('.common a').prop('href');
            if (entry_id > options.latest_post.get()) {
                max_id = Math.max(max_id, entry_id); // set max
                var note = new Notification(entry.find('.common a').text(), {
                    body: '由' +
                        jQuery.trim(entry.find('.by:eq(1)').text()).replace('\n', '于') +
                        "发布在" +
                        jQuery.trim(entry.find('.by:eq(0)').text()),
                    icon: 'http://steamcn.com/favicon.ico'
                });
                note.onshow = function (e) {
                    setTimeout(function () {
                        e.target.close()
                    }, 10 * 1000)
                };
                note.onclick = function (e) {
                    window.open(entry_link);
                    e.target.close();
                };

                //create email string
                var email_content = {
                    link: entry_link,
                    title: note.title,
                    detail: note.body
                };
                found_post.push(email_content);
            }
        });

        if (found_post.length > 0) {
            send_email(found_post);
            options.latest_post.set(max_id);
        }
    });
}

function set_enable(enabled) {
    if (enabled) {
        options.status.set(1);

        timer = setInterval(check_for_post, scan_interval);
    } else {
        options.status.set(0);
        clearInterval(timer);
    }
}

function init() {

    var insert_elem = jQuery('<li class="lc-pushing-switch"><a>设置推送</a></li>');
    insert_elem.css('cursor', 'pointer');
    insert_elem.css('font-weight', 'bold');
    insert_elem.click(construct_setting_panel);
    jQuery('#umnav_menu').append(insert_elem);

    set_enable(options.status.get() != 0);
}

jQuery(init);

