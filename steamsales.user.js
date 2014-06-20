// ==UserScript==
// @name           SteamSummerSales2014
// @namespace      https://github.com/lostcoaster/userscripts
// @author         lostcoaster
// @version        0.9
// @description    steam summer sales 2014 aid
// @grant          unsafeWindow
// @include        /https?:\/\/store\.steampowered\.com\/*/
// @matches        /https?:\/\/store\.steampowered\.com\/*/
// @updateURL      http://lostcoaster.github.io/userscripts/steamsales.user.js
// ==/UserScript==

//usage : javascript:(function(){document.body.appendChild(document.createElement('script')).src='http://lostcoaster.github.io/userscripts/steamsales.user.js';})();

(function(){
    "use strict";

    var myWindow;
    try{
        myWindow = unsafeWindow;
    } catch(e){
        myWindow = window;
    }

    var $ = myWindow.jQuery;

    var storage_string = 'steamsummersales_user_js';

    //check dependency availability
    if(!localStorage || !Notification || !JSON){
        throw Error('SSS.user.js: Browser is not supported')
    }

    /**
     * load named variable
     * @param {string} name - variable name
     * @returns {*} the variable
     */
    function load_setting(name){
        var settings = localStorage.getItem(storage_string);
        if(settings){
            settings = JSON.parse(settings);
            return settings[name];
        } else {
            return undefined;
        }
    }

    /**
     * save variable
     * @param {string} name - name of variable
     * @param {*} value - the value to save, should be stringifiable
     */
    function save_setting(name, value){
        var settings = localStorage.getItem(storage_string);
        if(settings){
            settings = JSON.parse(settings);
        } else {
            settings = {};
        }
        settings[name] = value;
        localStorage.setItem(storage_string, JSON.stringify(settings));
    }

    /**
     * randomly choose a side and send
     */
    function auto_vote(){
        do_vote(Math.round(Math.random()));
    }

    /**
     * vote groups waiting to be shown
     * @type {[string[]]}
     */
    var vote_groups = [];

    /**
     * notifications being shown
     * @type {Notification[]}
     */
    var active_notes = [];

    /**
     * add found name to group, if all names are found, raise notification
     * @param {number} group -- 0 for first group, 1 for second
     * @param {string} name -- name of game, includes discount if available
     */
    function update_name(group, name){
        console.log('SSS: registering '+ name + ' for group'+ group);
        var slot = vote_groups[group].indexOf(undefined);
        if(slot >= 0){
            vote_groups[group][slot] = name;
        }

        //check groups
        if(vote_groups.every(function(d){return d.indexOf(undefined) === -1})) {
            //raise notification

            for (var i = 0; i < vote_groups.length; i++) {
                var votes = vote_groups[i];
                var note = new Notification('新投票:第'+(i+1)+'组(点击给它投票)',
                    {body:votes.join('\n')});
                note.group = i;
                note.onclick = on_notification_click;
                note.onclose = on_notification_close;
                active_notes.push(note);
            }

            //clear
            vote_groups = [];
        }
    }

    /**
     * event handling
     * @param {Event} event - click event
     */
    function on_notification_click(event){
        var note = event.target;
        //vote
        console.log('SSS: voting group' + note.group);
        do_vote(note.group);
    }

    /**
     * cancel a notification
     * @param {Event} event
     */
    function on_notification_close(event){
        var note = event.target;
        active_notes.splice(active_notes.indexOf(note), 1);
    }

    /**
     * literal
     * @param {number} group - 0 for first group
     */
    function do_vote(group){
        console.log('SSS: voting for group '+ (group+1));
        var this_vote = $J('.vote_option_group').attr('data-voteid');
        myWindow.OnVoteClick(this_vote, group+1);
        save_setting('last_vote', this_vote);

        //close all
        for (var i = 0; i < active_notes.length; i++) {
            active_notes[i].close();
        }
        //clear
        active_notes = [];
    }

    /**
     * find the vote dialog and raise notification
     */
    function get_vote(){
        var last_vote = load_setting('last_vote');
        var this_vote = $J('.vote_option_group').attr('data-voteid');
        if(this_vote == last_vote){
            return; //same as last vote
        }

        if(!myWindow.g_$VoteDialog){
            myWindow.ShowVoteDialog();
        }

        var dialog = myWindow.g_$VoteDialog;
        if(dialog.find('.voted').length > 0) {
            //already voted
            save_setting('last_vote', this_vote);
            return;
        }

        // do I have time ?
        if ($('#vote_countdown').text().indexOf('00:00:') >= 0){
            //last minute, just vote!
            auto_vote();
            return;
        }

        if(vote_groups.length > 0 || active_notes.length > 0) return ; //previous groups exist

        dialog.find('.vote_option_group').each(function(i,d){
            var ind = vote_groups.push([]) - 1; // index of group
            $(d).find('.vote_option_game').each(function(i,g){
                vote_groups[ind].push(undefined);
                var url = $(g).attr('href');
                console.log('SSS: requesting game info from '+url);
                $.ajax({
                    url: url,
                    group: ind,
                    info: $.trim($(g).find('.discount').text()) + '(' + $.trim($(g).find('.discount_final_price').text()) + ')',
                    success: function(data){
                        var ajax_data = $(data);
                        var name = ajax_data.find('.apphub_AppName').text() + ':' +
                            this.info +
                            (ajax_data.find('.game_area_already_owned').length > 0 ? '-Owned':'');

                        update_name(this.group, name);
                    }
                });
            });
        });
    }

    /**
     * init, initial, initialize, initialization, initializationism
     */
    function init(){
        setInterval(function(){get_vote()},10000);
        $('#global_actions').append('<span>SSS Running</span>');
    }

    //run
    $(function(){init()});
})();