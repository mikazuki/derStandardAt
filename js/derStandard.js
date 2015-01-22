var initialized = false;

(function(redirectMobile, showCheckboxes) {
	"use strict";

	var settings;

	safari.self.addEventListener( "message", function(e) {
		if(e.name === "setSettings") {
			settings = e.message;
			if(initialized) {
				return;
			} else {
				initialized = true;
				init();
			}
		}
	}, false);

	var init = function() {
		var mobileRe = /(https?:\/\/)(\w+)\.derstandard\.at\/(\d+)\/(.*)/i;
		var match = mobileRe.exec(document.location+'');
		if(match != null && settings.redirect_mobile) {
			var proto = match[1];
			var version = match[2];
			var id = match[3];
			var desc = match[4];
			var target = proto + 'derstandard.at/permanent/' + id + '/' + desc;
			document.location = target;
			return;
		}

		var db;
		try {
	        var shortName = 'derstandard';
	        var version = '1.0';
	        var displayName = 'DerStandard Read Articles';
	        var maxSize = 67108864; // 64MB in bytes
	        db = openDatabase(shortName, version, displayName, maxSize);
		} catch(e) {
		    // Error handling code goes here.
		    if (e == 2) {
		        // Version number mismatch.
		        console.log("Invalid database version.");
		    } else {
		        console.log("Unknown error "+e+".");
		    }
		    return;
		}

		db.transaction(function(tx) {
			tx.executeSql('create table articles (id varchar(255) not null primary key, added timestamp not null, read integer(1) not null default 0)');
		});

		db.transaction(function(tx) {
			tx.executeSql("delete from articles where added < date(\'now\', \'-14 days\') ");

			tx.executeSql('select count(*) as total, sum(read) as read  from articles', [], function(tx, res) {
				console.log('articles in database', res.rows.item(0)['total']);
				console.log('read articles in database', res.rows.item(0)['read']);
			});
		});

		var stories=new Map();

		var storySel = "li.big:not(.group), li.normal:not(.group)";

		var getStoryId = function(e) {
			return e.getAttribute('id');
		};

		Array.prototype.forEach.call(
			document.querySelectorAll(storySel),
			function(e) {
				if(e.hasAttribute('id')) {
					var id = getStoryId(e);
					stories.set(id, {
						'id': id,
						'element': e,
						'mark_read': function() {
							if(/\s*ds_read\s*/.test(e.getAttribute('class'))) {
								console.log('alread marked as read');
								return;
							}

							var readBtn = e.querySelector('h6 a');
							if(readBtn != null)
								readBtn.remove(); 

							db.transaction(function(tx) {
								tx.executeSql(
									'update articles set read = ? where id = ?',
									[1, id],
									function(){},
									function(tx, err) {
										console.log('error updating article',err,id);
									}
								);
							});

							e.setAttribute('class', e.getAttribute('class') + ' ds_read');
							e.setAttribute('style', 'opacity: 0.3 !important');
						}
					});
				} else {
					console.log('warn: found element with no id', e);
				}
			}
		);

		var newReadButton = function() {
			var readBtn = document.createElement('a');
			readBtn.innerHTML = '&#x2611;&#xfe0f;'
			readBtn.setAttribute('style', 'float:right;cursor:pointer;padding-top:2px;');
			return readBtn;
		};

		db.transaction(function(tx) {
			stories.forEach(function(s) {
				tx.executeSql('select read from articles where id = ?', [s.id], function(tx, res) {
					var read = false;
					if(res.rows.length == 0)
						console.log('new article', s);
					if(res.rows.length >= 1) {
						if(res.rows.length > 1)
							console.log('warn: more than one article with id ' + s.id + ' found');

						read = res.rows.item(0)['read'] == 1;
					}

					if(read) {
						s.mark_read();
						return;
					} else {
						if(settings.show_checkboxes) {
							var readBtn = newReadButton();
							readBtn.onclick = function(e) { s.mark_read(); e.preventDefault(); }
							var header = s.element.querySelector('h6');
							if(header != null)
								header.appendChild(readBtn);
							else {
								// var small = s.element.querySelector('small');
								// if(small != null)
								// 	small.appendChild(readBtn);
								// else
								// 	console.log('warning no small found', s);
							}
						}

						s.element.ondblclick = function(e) { s.mark_read(); }
					}

					tx.executeSql("insert into articles(id,added,read) values (?,date(\'now\'),?)", [s.id, 0]);
				});
			});
		});

		if(settings.show_checkboxes) {
			var markSubsRead = function(container) {
				return function(e) {
					Array.prototype.forEach.call(
						container.querySelectorAll(storySel),
						function(e) {
							var id = getStoryId(e);
							stories.get(id).mark_read();
						}
					);
				}
			};

			Array.prototype.forEach.call(
				document.querySelectorAll('.well-section'),
				function(w) {
					var menu = w.querySelector('.menu');
					var readBtn = newReadButton();
					readBtn.setAttribute('style', readBtn.getAttribute('style')+'margin-right: -16px;margin-top:-8px;');
					readBtn.onclick = markSubsRead(w);
					menu.appendChild(readBtn);
				}
			);

			var sectionReadButton = function(section) {
				if(section == null) return;

				var readBtn = newReadButton();
				readBtn.setAttribute('style', readBtn.getAttribute('style')+'margin-right: -16px;margin-top:-8px;');
				readBtn.onclick = markSubsRead(section);
				section.insertBefore(readBtn, section.firstChild);
			};

			sectionReadButton(document.querySelector('.newsflash'));
			sectionReadButton(document.querySelector('.headlines'));
			sectionReadButton(document.querySelector('.skyline'));
		}
	};

	safari.self.tab.dispatchMessage("getSettings");
})();