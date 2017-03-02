//
//  NoStreamsTableViewCell.swift
//  Stormtrooper
//
//  Created by Daniel Firsht on 1/18/17.
//  Copyright © 2017 IBM. All rights reserved.
//

import UIKit

class NoStreamsTableViewCell: UITableViewCell {
    var didSelectInviteFriends: (() -> Void)?
    @IBOutlet weak var inviteFriendsButton: UIButton!

    @IBAction func didSelectInviteFriends(_ sender: Any) {
        didSelectInviteFriends?()
    }
    
    override func awakeFromNib() {
        super.awakeFromNib()
        inviteFriendsButton.layer.borderWidth = 1
        inviteFriendsButton.layer.borderColor = UIColor.togetherStreamOrange.cgColor
        inviteFriendsButton.cornerRadius = 16
    }

    override func setSelected(_ selected: Bool, animated: Bool) {
        super.setSelected(selected, animated: animated)

        // Configure the view for the selected state
    }

}