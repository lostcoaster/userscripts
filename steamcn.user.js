// ==UserScript==
// @name       SteamCN Notifier
// @namespace  http://lostcoaster.github.io/
// @version    0.1
// @author     lostcoaster
// @description  enter something useful
// @match      http://steamcn.com/forum.php*
// @grant      unsafeWindow
// @copyright  GPL license
// ==/UserScript==
var timer;
var scan_interval = 60 * 1000; //1分钟扫描间隔

function latest_id(id) {
    if (id) {
        localStorage.setItem('lc.latest_post_id', id);
        return id;
    } else {
        return Number(localStorage.getItem('lc.latest_post_id')) || 0;
    }
}

function send_email(contents) {
    var email = localStorage.getItem('lc.notify_email');
    if (!email) {
        return; // not to send
    }

    var html_content = '<img src="http://steamcn.com/template/steamcn_metro/src/img//logo_sc.png" alt="SteamCN 蒸汽动力" border="0">' +
        jQuery.map(contents, function (data) {
            return '<p><a href="' + data.link + '">' + data.title + '</a></p><p>' + data.detail + '</p>'
        }).join('<br><br>');
    var text_content = '以下是推送内容: \n\n' +
        jQuery.map(contents, function (data) {
            return data.title+'\n'+data.detail+'\n'+data.link;
        }).join('\n');
    var req_data = {
        "key": "TrPFSHUL5CSZGPg7I2OMZQ", // APIkey, 如果额度满了, 可能会有改动(估计满不了)
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
        .done(function(d){console.debug('Email sent, response -- ' + d)})
        .fail(function(){console.error('Email sending failed')})
}

function check_for_post() {
    var parser = new DOMParser();

    //avoid multiple tabs check simultaneously, resulting some confusing results.
    var now = (new Date()).getTime();
    if (now - Number(localStorage.getItem('lc.last_check') || '0') <= scan_interval / 2) {
        // there will be one stopping
        return;
    } else {
        localStorage.setItem('lc.last_check', now.toString());
    }

    jQuery.get('http://steamcn.com/forum.php?mod=guide&view=newthread').done(function (data) {
        var page = jQuery(parser.parseFromString(data, 'text/html'));
        var found_post = [];
        var max_id = 0;
        page.find('tbody[id]').each(function (i, d) {
            var entry = jQuery(d);
            var entry_id = Number(entry.attr('id').match(/\d+/)[0]);
            var entry_link = entry.find('.common a').prop('href');
            if (entry_id > latest_id()) {
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

        if(found_post.length > 0){
            send_email(found_post);
            latest_id(max_id);
        }
    });
}

function set_enable(enabled) {
    var insert_elem = jQuery('.lc-pushing-switch');
    if (enabled) {
        localStorage.setItem('lc.steamcn_notify_status', '1');
        insert_elem.find('a').text('关闭推送');
        insert_elem.click(function () {
            set_enable(false);
        });

        if (!localStorage.getItem('lc.notify_email')) {
            var email = jQuery.trim(window.prompt('可以开启邮箱推送功能(测试). 需要开启吗? \n 需要请输入邮箱 \n 不需要直接确定即可'));
            if (email) {
                alert('你输入的邮箱是' + email + ', 如果有误, 请点击关闭推送, 然后重新打开输入.');
                localStorage.setItem('lc.notify_email', email);
            } else {
                localStorage.setItem('lc.notify_email', '');
            }
        }
        timer = setInterval(check_for_post, scan_interval);
    } else {
        localStorage.setItem('lc.steamcn_notify_status', '0');
        insert_elem.find('a').text('启动推送');
        insert_elem.click(function () {
            set_enable(true);
        });
        localStorage.removeItem('lc.notify_email');
        clearInterval(timer);
    }
}

function init() {

    var insert_elem = jQuery('<li class="lc-pushing-switch"><a></a></li>');
    insert_elem.css('cursor', 'pointer');
    insert_elem.css('font-weight', 'bold');
    jQuery('#umnav_menu').append(insert_elem);

    set_enable(localStorage.getItem('lc.steamcn_notify_status') == '1');
}

jQuery(init);

