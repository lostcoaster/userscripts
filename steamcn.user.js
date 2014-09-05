// ==UserScript==
// @name       SteamCN Notifier
// @namespace  http://lostcoaster.github.io/
// @version    0.2.0
// @author     lostcoaster
// @description  enter something useful
// @include    /http:\/\/steamcn\.com\/.*/
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
                if (temp == null || temp === '') { // only this two is invalid
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
                if(temp != '-') { // now the beacon is not required anymore
                    this['email'].set(temp);
                }
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
    jQuery('<style>.pbl p>div{background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAMAAADXqc3KAAABxVBMVEUAAAAGmwUEmwMGmwZFuT83sjFIu0I7tTcapRkFmAUXoxU/tjo2sjESoRABmgEFmwRIukI/tjkImwcTohEAlgAPoA5NvUdEuD82sTMRoBFDuD0AlQAOnw1HuUEgqB4EmwQurioTohEAmABMu0UJnQgYpBY4sjMzsC4gqB00sTAqrCcYpBY+tTgFmwUUohJl0mNWvl2U1ZmOzZaS2ZWCyouM4YeG3oR4z3t103Rjvm1nympgvWpgxWRYyFpVwFpex1hSxlRHs1JKuFE2tD4kqSOc3p2Z25uT5Y6GzI6R5YyAy4d20Hl92XduwnZ12nFtzHBrxnBs0mxq1GhavWFezl5Yw11Zy1lPuVhOuVJCsU9DtE1JwUxHtEs+skk8rklCtEM1qUNEuEExqD81rzYqqzQmqDIoqSoqrCgdpR8boh6a2J+R0piOz5aR1pSIzZCM2Y2D14SB14GF34B+z4CC3X55zH5913tww3p0wnp72Xl1yHlyy3dxyXdy0XR11HBnxGllymRXt2Rj0WFczFxVu1lQvVdRwlVFtk9TwU5JtU5NvEpDvEg6rEhBukc+rkI2rT06tDcwry8foS4epCoaoicSnSEAlAI+J5dhAAAAL3RSTlMAEM9gICDv7+/v37+/n5+AcHBwMDAg7+/v79/fz7+/v6+vr4+PgHBwcGBgYFBQQHZnFxEAAAFHSURBVCjPYsAEjMz8zAzYxJn6neK5hDEl5IONTEx85TDEddNyynsirV0wDJL0youMc7RMR5dQici2jo2ybFFAExfOMPSKag8OkGBFk5CpMjRwMqhJVEcTF4rPKm21q7bhQRMX5TDMDQ31N2dnhXhUSAQqoVjvZtVm692lBuKIcPbFZCoxgph6ycbm0Q4WDRCDAJOuMDLxiGECyjByFRvb2gaWQQximGZkmeBo3ckkyqBq51YbFmTWIQgxl9OjMWFSangEh3a6cX6IvlkdN9RC/mTfpKlTUgwCXMxdA/VLTMVZYG7ky4xLmpzqbOPtWtjk524PNAguk+EYm+Lca1WgH+Tpw43sL960cCfnbodm/SJPNhYGFBkXA7tohxCgQQJoYaEx0cYqTN/URxYj3rQm+FtUmoqxYMa0ZqKFGcggTKAjxaaMzAcA5O1EOzcjGBYAAAAASUVORK5CYII=) no-repeat;height: 25px;width: 25px;position: relative;top: -25px;left: 0 }</style>').appendTo('head');

    // all forums, may update if changed
    var all_forums = ["148", "188", "161",
            "305", "271", "234", "197", "254", "127", "200", "161", "188", "234", "271", "129", "257", "201", "254",
            "189", "127", "235", "261", "301", "302", "303", "304", "291", "299", "305", "280", "281", "282", "297",
            "293", "294", "295", "296", "307", "308", "309", "310", "207", "244", "246", "245", "248", "255", "270",
            "251", "232", "274", "275", "276", "277", "148", "259", "273", "200", "140", "197", "238", "163", "202",
            "262", "298", "233", "258"];
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
    enable_container.css({'text-align':'center', 'font-size':'200%', 'font-weight':'bold'});
    container.append(enable_container);
    var forum_list_container = jQuery('<div id="lc-forum-list"><a href="javascript:;">点击一个板块2次进行选择, 你也可以点击这里进行 [清空/全选]</a><ul class="pbl cl"><li count="0"></li><li count="1"></li><li count="2"></li></ul></div>');
    forum_list_container.find('a').click(function(){
        if(selected_forums.length){selected_forums=[]}
        else{selected_forums=all_forums}
        show_forum_state();
    }).css('display','block');
    container.append(forum_list_container);
    var special_name_container = jQuery('<div><span style="display: inline-block; float: left;">黑/白名单的用户名<br>一行一个</span><textarea style="float: left; height: 100px; width: 300px;"></textarea><label><input type="radio" name="lc-black-switch" value="1">黑名单</label><br><label><input type="radio" name="lc-black-switch" value="0">白名单</label></div>');
    special_name_container.find('input[value="' + (options.is_blacklist.get() ? 1 : 0) + '"]').prop('checked', 'true');
    special_name_container.find('textarea').val(options.special_users.get().join('\n'));
    container.append(special_name_container);
    var email_container = jQuery('<div id="lc-email-container" style="clear:both"><label>邮箱 (如果不需要邮箱推送, 就留空): <input></label></div>');
    email_container.find('input').val(options.email.get());
    container.append(email_container);
    var api_key_container = jQuery('<div id="lc-api-key-container"><label>API Key (如果不知道那是什么, 就不要修改): <input></label></div>');
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
            if (d.className) {
                inserting.addClass(d.className);
            }
            inserting.attr('fid', d.getAttribute('fid'));
            inserting.text(d.innerText);
            target.append(inserting_holder);
        });
        // the clicking handler
        target.find('a').click(function (e) {
            var cur_col = Number(e.target.parentNode.parentNode.getAttribute('count'));

            var elem_fid = e.target.getAttribute('fid');

            if (e.target.parentNode.className && elem_fid != 'common') { // remember the non forum collection
                // if already select, toggle it in the list
                var index = selected_forums.indexOf(elem_fid);
                if (index != -1) {
                    selected_forums.splice(index, 1); // delete
                } else {
                    selected_forums.push(elem_fid); // add
                }
            } else {
                // otherwise just select
                jQuery('.pbls').removeClass('pbls');
                e.target.parentNode.className = 'pbls';
            }
            show_forum_state(); // in case not run. it does no harm anyway
            switch_forum(cur_col + 1, elem_fid);
        }); // end clicking handler
        show_forum_state();
    } // end switch_forum

    function show_forum_state(){
        forum_list_container.find('li:gt(0) p').each(function(i,link){
            link = jQuery(link);
            link.find('div').remove();
            if(selected_forums.indexOf(link.find('a').attr('fid')) != -1){
                link.append('<div/>');
            }
        })
    }
    /**
     * the callback handling save configuration data
     */
    function save_data(e) {
        options.status.set(Number(jQuery('input[name="lc-enable-switch"]:checked').val()));
        options.enabled_forums.set(selected_forums);
        var temp = jQuery('#lc-setting-panel').find('textarea').val().split('\n');
        temp = jQuery.map(temp, function (d) {
            return jQuery.trim(d); // trim the space
        }).filter(function (d) {
            return d; // trim the empty line
        });
        options.special_users.set(temp);
        options.is_blacklist.set(jQuery('input[name="lc-black-switch"]:checked').val() == '1');
        options.email.set(jQuery.trim(jQuery('#lc-email-container').find('input').val()));
        options.api_key.set(jQuery('#lc-api-key-container').find('input').val());
        e.target.innerText = '已保存, 正在刷新页面';
        location.reload(); // refresh
    }


    jQuery.get('http://steamcn.com/forum.php?mod=misc&action=nav&infloat=yes&handlekey=nav&inajax=1&ajaxtarget=fwin_content_nav')
        .done(set_forum_data);

    jQuery('body').append(panel);
} //end construct_setting_panel

/**
 * send emails
 * @param {object[]}contents
 */
function send_email(contents) {
    var email = options.email.get();
    if (!email) {
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
            "subject": "SteamCN有" + contents.length + "个新帖子",
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
        // avoid each getItem ... well not such big deal though
        var enabled_forums = options.enabled_forums.get();
        var latest_post = options.latest_post.get();
        var is_blacklist = options.is_blacklist.get();
        var special_users = options.special_users.get();
        page.find('tbody[id]').each(function (i, d) {
            var entry = jQuery(d);
            var entry_id = Number(entry.attr('id').match(/\d+/)[0]);
            var entry_link = entry.find('.common a').prop('href');

            // filters
            var author = jQuery.trim(entry.find('.by:eq(1) a').text());
            var time = jQuery.trim(entry.find('.by:eq(1) span:first').text());
            var forum_link = entry.find('.by:eq(0) a');
            // filter forum
            var fid = forum_link.attr('href').match(/f(\d+)/);
            if(!fid){ console.error('fid matching failed ! elem: ', forum_link); debugger; }//strange error if happens
            if(enabled_forums.indexOf(fid[1]) == -1){return;} // not in right forum
            // filter user
            if(is_blacklist ^ (special_users.indexOf(author) == -1)) {return;}

            if (entry_id > latest_post) {
                max_id = Math.max(max_id, entry_id); // set max
                var note = new Notification(entry.find('.common a').text(), {
                    body: '由' +
                        author + '于' + time +
                        "发布在" +
                        jQuery.trim(forum_link.text()),
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

