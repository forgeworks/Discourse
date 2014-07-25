// When the page loads, have discourse follow all threads
$(function() {
    $('.discourse .thread').each(function(i, e) {
        discourse.follow($(e).attr('rel'));
    })
});

// When a user focuses on a textarea it adds "focused" to the form this allows us to do things like 
// change the color of the submit button to blue.
$(document).on('focus', '.discourse .thread textarea', function(e) {
    $(this).closest('form').addClass('focused');
});
$(document).on('blur', '.discourse .thread textarea', function(e) {
    $(this).closest('form').removeClass('focused');
});

// When 'delete' is pressed on a comment, it is deleted.
$(document).on('click', '.discourse .thread .controls .delete', function(e) {
    deleteComment($(e.target).closest('.comment'));
    e.preventDefault();
});

// When 'reply' is pressed on a comment, the form is copied and added to the end of the subthread.
$(document).on('click', '.discourse .thread .controls .reply', function(e) {
    replyTo($(e.target).closest('.comment'));
    e.preventDefault();
});

// When the user blurs on a reply form, clear them.
$(document).on('blur', '.discourse .thread textarea', function(e) {
    //clearReplyForms();
});

// When 'edit' is pressed, the comment is hidden and replaced with a form to edit it.
$(document).on('click', '.discourse .thread .controls .edit', function(e) {
    editComment($(e.target).closest('.comment'));
    e.preventDefault();
});

// When the down arrow or up arrow are pressed, a vote is cast.
$(document).on('click', '.discourse .thread .voting a', function(e) {
    var comment = $(e.target).closest('.comment');
    var target = $(e.target).closest('a');

    if ((target.hasClass('upvote') && target.hasClass('selected')) || (target.hasClass('downvote') && target.hasClass('selected'))) {
        voteComment(comment, 0);
    } else if (target.hasClass('upvote')) {
        voteComment(comment, 1);
    } else if (target.hasClass('downvote')) {
        voteComment(comment, -1);
    }
    e.preventDefault();
});


// When discourse tells us that there is a new comment
discourse.on('comment', function (comment) {
    realizeComment(comment);
});

// When discourse tells us there's a new vote.
discourse.on('vote', function (data) {
    var comment = $('#comment-' + data.id);
    var value = data.value;

    comment.find('.meta .score').empty().append(value).fadeOut().fadeIn();
});

 // When discourse tells us a comment was deleted.
discourse.on('delete', function(id) {
    var comment = $('#comment-' + id);
    var comment_and_subthread = comment.add(comment.next('.subthread'));

    comment_and_subthread.fadeOut('normal', function() {
        comment_and_subthread.remove();
    });
});


// When a form is submited on the threads, we should use ajax to submit it.
$(document).on('submit', '.discourse .thread form', function(e) {
    e.preventDefault();
    var form = $(this);
    var comment = form.closest('.comment');
    var data = {
        body: $(this).find('[name=body]').val(),
        parent: $(this).find('[name=parent]').val()
    }

    if (comment.length > 0)
        data.in_reply = comment.attr('id').substring('comment-'.length);
    
    $.ajax({
        url: form.attr('action'),
        data: data,
        type: 'post',
        success: postCommentSuccess,
        error: function(response) {
            formError(form, response);
        }
    });
});

function formError(form, response) {
    console.log("ERROR", form, response);
}

function findThread(path) {
    return $('.discourse .thread').filter(function() {
        return $(this).attr('rel') == path;
    });
}

function realizeComment(comment) {
    var source = $('#comment-' + comment.id);
    var parent = $('#comment-' + comment.parent);

    if (source.length == 0) {
        var thread = findThread(comment.path);
        var prototype = thread.find('.comment.prototype').first();
        var source = prototype.clone().removeClass('prototype');

        if (parent.length == 0) {
            if (thread.find('.insert-comments-here').length > 0)
                thread.find('.insert-comments-here').before( source.show() );
            else
                thread.append(source.show());
        } else {
            var container = parent.closest('.subthread');
            if (container.length == 0) {
                container = parent.next('.subthread');
            }
            container.append(source.show());
        }

        source.addClass('created');
    } else {
        if ( source.hasClass('created') ) {
            return;
        }
    }

    // Container
    source.attr('id', 'comment-' + comment.id);
    if (comment.deleted)
        source.addClass('deleted');
    else
        source.removeClass('deleted');

    // Meta
    source.find('.meta .score').empty().append(comment.value);
    source.find('.meta .voting a').removeClass('selected');
    if (comment.up)
        source.find('.meta .voting a.upvote').addClass('selected');
    if (comment.down)
        source.find('.meta .voting a.downvote').addClass('selected');

    // Icon
    source.find('.user-icon').attr('href', comment.author.url || '#');
    source.find('.user-icon img').attr('src', comment.author.thumbnail || '/static/img/star.jpg')
                                 .attr('alt', comment.author.name)
                                 .attr('title', comment.author.name);

    // Body
    source.find('.info .body a').attr('href', comment.author.url || '#')
                                .empty()
                                .append(comment.author.name);
    source.find('.info .body .html').empty()
                                    .append(comment.html);
    source.find('.info .body .text').empty()
                                   .append(comment.text);

    // Date
    source.find('.date')
          .attr('title', comment.created)
          .empty()
          .append(comment.naturaltime);

    // Controls
    if (comment.editable) {
        source.find('.controls .edit').show();
        source.find('.controls .delete').show();
    } else {
        source.find('.controls .edit').hide();
        source.find('.controls .delete').hide();
    }

    // Subthread
    if (!comment.parent) {
        source.after('<div class="subthread">');
    }

    return source;
}

function postCommentSuccess(result) {
    clearReplyForms();
    $('.discourse .thread form textarea').val('');
    var source = realizeComment(result);
    source.scrollTo(500, 'swing', function() {
        source.fadeTo(250, 0).fadeTo(500, 1);    
    });
}

function deleteComment(comment) {
    var url = comment.closest('.thread').find('form').first().attr('action');
    var id = comment.attr('id').substring('comment-'.length);
    var comment_and_subthread = comment.add(comment.next('.subthread'));

    $.ajax({
        url: url,
        data: {'delete': id},
        success: function() {
            comment_and_subthread.fadeOut('normal', function() {
                comment_and_subthread.remove();
            });
        },
        error: function() {
            comment.fadeOut('fast').fadeIn('fast');
        }
    });
}

function replyTo(comment) {
    var prototype = comment.closest('.thread').find('form').first();
    var subthread = comment.closest('.subthread');
    var reply_to = comment.attr('id').substring('comment-'.length);

    if (subthread.length == 0) {
        subthread = comment.next('.subthread');
    } else {
        reply_to = subthread.prev('.comment').attr('id').substring('comment-'.length);
    }

    var form = subthread.find('form');
    if (form.length == 0) {
        clearReplyForms();
        form = prototype.clone().addClass('temporary');
        form.find('[name=parent]').val(reply_to);
        form.find('[type=submit]').val("Add Reply");
        subthread.append( form );
    }
    
    form.find('textarea').focus();
    form.show();
}

function editComment(comment) {
    clearReplyForms();

    var prototype = comment.closest('.thread').find('form').first();
    var id = comment.attr('id').substring('comment-'.length);
    var text = comment.find('.text').html();

    form = prototype.clone().addClass('temporary');
    comment.hide().before(form);
    form.find('[name=pk]').val(id);
    form.find('[type=submit]').val("Save Changes");
    form.find('textarea').val(text).focus();
}

function clearReplyForms() {
    $('.discourse .thread form.temporary').remove();
    $('.discourse .thread .comment').not('.prototype').show();
}

function voteComment(source, vote) {
    var url = source.closest('.thread').find('form').first().attr('action');
    var id = source.attr('id').substring('comment-'.length);
    var score = source.find('.meta .score');

    source.find('.meta .voting a').removeClass('selected');

    if (vote == 1)
        source.find('.meta .voting a.upvote').addClass('selected');
    else if (vote == -1)
        source.find('.meta .voting a.downvote').addClass('selected');

    $.ajax({
        url: url,
        data: {'vote': vote, 'pk': id},
        success: function(result) {
            score.empty().append(result);
        }
    });
}
